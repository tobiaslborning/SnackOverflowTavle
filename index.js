const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

let lastPurchasedProducts = [];

// Middleware to parse the JSON body of the incoming requests
app.use(express.static('public'));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

app.post('/webhook', (req, res) => {
    // console.log('Received a POST request on /webhook');
    // console.log('Body:', req.body); 
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
    if (body.eventName === "PurchaseCreated") {
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
});

const port = process.env.PORT || 80;
server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

