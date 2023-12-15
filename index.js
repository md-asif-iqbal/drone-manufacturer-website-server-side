const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const crypto = require('crypto'); // Include the crypto module
const CryptoJS = require("crypto-js");

const winston = require('winston');
const { log } = require('console');

require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);


const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});


const app = express();
const port = process.env.PORT || 8000;
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gef4s.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// JWT Token here
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
      if (err) {
        return res.status(403).send({ message: 'Forbidden access' })
      }
      req.decoded = decoded;
      next();
    });
  }


// encryption and decryption
const encodeFn = (data) => {
  const cipherText = CryptoJS.AES.encrypt(
    JSON.stringify(data),
    process.env.SECRET_KEY
  ).toString();
  return cipherText;
};

const decodedFn = (data) => {
  const bytes = CryptoJS.AES.decrypt(data, process.env.SECRET_KEY);
  const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  return decryptedData;
};




  async function run(){
      try{
        await client.connect();
        const partsCollection = client.db('drone_kits').collection('parts');
        const purchaseCollection = client.db('drone_kits').collection('purchase');
        const userCollection = client.db('drone_kits').collection('users');
        const reviewCollection = client.db('drone_kits').collection('reviews');
        const paymentCollection = client.db('drone_kits').collection('payment');


        // User Access Token
        // Use the encryption function before storing the user's password
    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      user.password = encodeFn(data.password);
      user.role = encodeFn(data.role);
    
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      try {
        
        const result = await userCollection.updateOne(filter, updateDoc, options);
        const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
        logger.info(`User updated: ${email}`);

        res.send({ result, token });
      } catch (error) {
        logger.error(`Error updating user: ${email}`, error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

          // use Admin Function
  const verifyAdmin = async (req, res, next) => {
    const requester = req.decoded.email;
    const requesterAccount = await userCollection.findOne({ email: requester });
    console.log(requesterAccount);
    if (requesterAccount.role === 'admin') {
      next();
    }
    else {
      res.status(403).send({ message: 'forbidden' });
    }
  }
      
        // Get Parts here 
        app.get('/parts' , async(req , res) =>{
          const quary ={}
          const cursor = partsCollection.find(quary);
          const result = await cursor.toArray();
          res.send(result)
        })
        app.post('/parts' , verifyJWT,  async(req , res) =>{
          const products = req.body;

          const result = await partsCollection.insertOne(products);
          return res.send({ success: true, result });
        })
        // // --------find One product id--------...
    app.get('/parts/:id' , async(req , res )=>{
      const id = req.params.id;
      console.log(id);
      const query = {_id: ObjectId(id)};
      const products = await partsCollection.findOne(query);
      res.send(products);
    })
    // Parts Deleted
    app.delete('/parts/:id' ,verifyJWT, async(req , res )=>{
      const id = req.params.id;
      console.log(id);
      const query = {_id: ObjectId(id)};
      const products = await partsCollection.deleteOne(query);
      res.send(products);
    })

    // Add single Purchase here
    app.post('/purchase', async (req, res) => {
      const purchase = req.body;
      // const query = { purchaseName: purchase.purchaseName, purchaseId: purchase.purchaseId, email: purchase.email }
      // const exists = await purchaseCollection.findOne(query);
      // if (exists) {
      //   return res.send({ success: false, purchase: exists })
      // }
      const result = await purchaseCollection.insertOne(purchase);
      return res.send({ success: true, result });
    });
    // payment pruchase update......
    app.patch('/purchase/:id', verifyJWT, async(req, res) =>{
      const id  = req.params.id;
      const payment = req.body;
      const filter = {_id: ObjectId(id)};
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId
        }}
      const result = await paymentCollection.insertOne(payment);
      const updatedPurchase = await purchaseCollection.updateOne(filter, updatedDoc);
      res.send(updatedPurchase);
    })

    // find My Order
    app.get('/purchase' , verifyJWT, async(req , res) =>{
      const buyerEmail = req.query.buyerEmail;
      const decodedEmail = req.decoded.email;
      if(buyerEmail === decodedEmail){
        const quary = {buyerEmail : buyerEmail};
        const purchased = await purchaseCollection.find(quary).toArray();
        res.send(purchased);
      }
      else{
        return res.status(403).send({ message: 'Forbidden Access'})
      }
      
    })
    app.get('/purchase/:id', verifyJWT, async(req , res) =>{
      const id = req.params.id;
      const query = {_id: ObjectId(id)};
      const result = await purchaseCollection.findOne(query);
      res.send(result)
    })

    app.delete('/purchase/:id', async(req , res) =>{
      const id = req.params.id;
      const query = {_id: ObjectId(id)};
      const result = await purchaseCollection.deleteOne(query);
      res.send(result)
    })

    // all order here
     // Get Parts here 
     app.get('/allorders' , verifyJWT, async(req , res) =>{
      const quary ={}
      const cursor = purchaseCollection.find(quary);
      const result = await cursor.toArray();
      res.send(result)
    })
    // purchase Status Update
    app.put('/allorders/:id', verifyJWT, async (req, res) => {
      const id  = req.params.id;

      const filter = {_id: ObjectId(id)};
      const updateDoc = {
        $set: { status: 'shipped' },
      };
      const result = await purchaseCollection.updateOne(filter, updateDoc);
      console.log(result);
      res.send(result);
    })

    // update a new stock available
    // app.put('/parts/:id' , async (req ,res) =>{
    //   const id = req.params.id;
    //   const quantity = req.body;
    //   const query = {_id: ObjectId(id)};
    //   const options = { upsert: true };
    //   const updateDoc = {
    //     $set: {
    //       stock:quantity.newStock
    //     },
    //   };
    //     const result = await partsCollection.updateOne
    //     (query,updateDoc,options);
    //     res.send(result) ;
        
    // })

    // <<<<<------Add Review Here-------->>>>>>>
    app.post('/review', verifyJWT, async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });
    // <<<<<------Get Review Here------>>>>>>

    app.get('/reviews' ,  async(req , res) =>{
      const quary ={}
      const cursor = reviewCollection.find(quary);
      const result = await cursor.toArray();
      res.send(result)
  
    })
  // Update user..........

    app.put('/users/:email', async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const profile = req.body;
      console.log(profile);

      const filter = { email: email };
      const updateDoc = {
        $set: {
          name: profile.name,
          image: profile.img,
          number: profile.number,
          education: profile.education,
          location: profile.location,
        }
      };

      const result = await userCollection.updateOne(filter, updateDoc);
      
      res.send(result);
    });
    // user Update Profile
    app.get('/users' , verifyJWT, async(req , res) =>{
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if(email === decodedEmail){
        const quary = {email : email};
        const purchased = await userCollection.find(quary).toArray();

        res.send(purchased);
      }
     

      else{
        return res.status(403).send({ message: 'Forbidden Access'})
      }
      
    })
     // _______>>>>>>> Users alll--------<<<<<>>>>>
    app.get('/user', verifyJWT, verifyAdmin, async (req, res) => {
      const users = await userCollection.find().toArray();
      users.password = decodedFn(users.password);
      users.role = decodedFn(users.role);
      res.send(users);
    });
    // <<<<<<Payments here >>>>>>>>
    app.post('/create-payment-intent', verifyJWT, async(req, res) =>{
      const service = req.body;
      console.log(service);
      const price = service.totalPrice;
      const amount = price*100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount : amount,
        currency: 'usd',
        payment_method_types:['card']
      });
      res.send({clientSecret: paymentIntent.client_secret})
    });
    // ========here--------
    // admin here========
    app.get('/admin/:email', async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      user.password = decodedFn(user.password);
      user.role = decodedFn(user.role);
      const isAdmin = user.role === 'admin';
      res.send({ admin: isAdmin })
    })
    // donee ....
    // -----user admin email find-------
    app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const filter = { email: email };
      const updateDoc = {
        $set: { role: 'admin' },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    })
    


      }
       finally{

       }
  }
  run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello From Drone Kits ..!')
})

app.listen(port, () => {
  console.log(`Drone Kits listening on port ${port}`)
})