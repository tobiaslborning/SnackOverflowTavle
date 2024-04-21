const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const axios = require('axios');
const io = new Server(server);
const qs = require('qs');

let lastPurchasedProducts = [];

// Middleware to parse the JSON body of the incoming requests
app.use(express.static('public'));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

app.post('/webhook', (req, res) => {
    // console.log('Received a POST request on /webhook');
    console.log('Body:', req.body.eventName); 
    // You can add your logic here to handle the webhook
    // Parse the payload field in the body
    const payload = JSON.parse(req.body.payload);
    const body = req.body;

    console.log("\n---------- REGISTERED EVENT ----------");
    const date = new Date(body.timestamp);  
    
    console.log('Timestamp:', date.getDate() + "/" + (date.getMonth() + 1) + " at " + date.getHours()+ ":" + date.getMinutes()+ ":" + date.getSeconds());
    
    // Extract the name field from the products array in the payload
    if (body.eventName === "ProductUpdated") {
        const productName = payload.newEntity.name;
        const productPrice = payload.newEntity.variants[0].price.amount;
        console.log('\n----------- PRODUCT UPDATED! -----------\n');
        console.log('Product Name:', productName);
        console.log('Product Price:', (productPrice / 100));
        console.log('\n----------------------------------------\n');
        io.emit('edit', [productName, productPrice]);
    }
    else if (body.eventName === "PurchaseCreated") {
        const products = payload.products;
        const payments = payload.payments;
        console.log('\n----------- PURCHASE CREATED! -----------\n');
        products.forEach((product, index) => {
            console.log('Product Name:', product.name);
            console.log('Product Price:', (product.unitPrice / 100) + " kr");
            console.log('Quantity:', product.quantity);
            console.log('\n');
        });
        lastPurchasedProducts = products;
        console.log('Total Amount:', (payments[0].amount / 100));
        io.emit('purchase', lastPurchasedProducts);
    }
    res.sendStatus(200);
});

app.get('/webhook', (req, res) => {
    res.render('products');
    if (lastPurchasedProducts.length > 0) {
        console.log("Skal loade products:" + lastPurchasedProducts[0].quantity)
        setTimeout(() => {
            io.emit('load', lastPurchasedProducts);
        }, 1000);
    }
});


setInterval(() => {
    // get internet status
    axios.get('http://www.ntnu.no')
        .then(function (response) {
            io.emit("internetStatus", response.status === 200);
        })
        .catch(function (error) {
            // handle error
            io.emit("internetStatus", false);
        });
    // get API status    
    updateApiStatus();
}, 10000);


// get API status
const updateApiStatus = () => {
    const data = qs.stringify({
        'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'client_id': '59f506be-f690-11ee-8ac7-757fa522f043',
        'assertion': 'eyJraWQiOiIwIiwidHlwIjoiSldUIiwiYWxnIjoiUlMyNTYifQ.eyJpc3MiOiJpWmV0dGxlIiwiYXVkIjoiQVBJIiwiZXhwIjoyNjU5Mzg4ODEwLCJzdWIiOiI1NTQ4YzM0ZS1kN2I0LTExZWUtOWI5Mi1lOTViMWU2OWMwMWQiLCJpYXQiOjE3MTI2ODEwMzQsInJlbmV3ZWQiOmZhbHNlLCJjbGllbnRfaWQiOiI1OWY1MDZiZS1mNjkwLTExZWUtOGFjNy03NTdmYTUyMmYwNDMiLCJ0eXBlIjoidXNlci1hc3NlcnRpb24iLCJ1c2VyIjp7InVzZXJUeXBlIjoiVVNFUiIsInV1aWQiOiI1NTQ4YzM0ZS1kN2I0LTExZWUtOWI5Mi1lOTViMWU2OWMwMWQiLCJvcmdVdWlkIjoiNTU0NmFhOTEtZDdiNC0xMWVlLTk2NTctNmE5ZmVkYjE5ZTRlIiwidXNlclJvbGUiOiJPV05FUiJ9LCJzY29wZSI6WyJSRUFEOlBVUkNIQVNFIiwiUkVBRDpQUk9EVUNUIl19.QZ4rD5yhoj2cRofBdxIQiiaPGNxpC_Fwe-rTS6ZX2A7621wF9vM6kkW9kx73gjovJ2ibielpDtNLTA8-C6d8mlvaRGOzmkWy-iZbAt5TEBwV7ZxAWvmCobOl5SlgFrGWIjE5UGv_3uTXj92JHgYmlnLw-BN1iBe0G-4Chh2ONdJj2Ghev-8xWaUcEFd2cV04FUYIjOyVW09rCUu5y3H-GNe65y4ELUdLqnHWV_G-tRCKZKURx0CvNbpZsc2CtSR6Is1I58u5uJPjKMuaqKwL23gVvZeG1qN077Ff-56COHGLiKKigtHPcMg7cGLe1odXdXBDOP18CVMW-PIKhvtelQ'
    });

    let config = {
        method: 'post',
        url: 'https://oauth.zettle.com/token',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: data
    };

    let accessToken = "";
    let status = axios(config)
        .then(function (response) {
            JSON.stringify(response.data.access_token);
            accessToken = response.data.access_token;

            const config2 = {
                method: 'get',
                url: 'https://pusher.izettle.com/organizations/5546aa91-d7b4-11ee-9657-6a9fedb19e4e/subscriptions',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`
                }
            };

            axios(config2)
                .then(function (response) {
                    JSON.stringify(response.data[0].status);
                    io.emit('apiStatus',response.data[0].status);
                })
                .catch(function (error) {
                    io.emit('apiStatus', "error");
                    console.log("error connecting to Zettle - API");
                });
        })
        .catch(function (error) {
            console.log(error);
            io.emit('apiStatus', "error");
        });
    
};

const port = process.env.PORT || 80;
server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

