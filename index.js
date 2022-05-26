const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

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


  async function run(){
      try{
        await client.connect();
        const partsCollection = client.db('drone_kits').collection('parts');
        const purchaseCollection = client.db('drone_kits').collection('purchase');
        const userCollection = client.db('drone_kits').collection('users');
        const reviewCollection = client.db('drone_kits').collection('reviews');
        const profileCollection = client.db('drone_kits').collection('profile');


        // User Access Token
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
              $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10h' })
            res.send({ result, token });
          });
        // Get Parts here 
        app.get('/parts' ,  async(req , res) =>{
          const quary ={}
          const cursor = partsCollection.find(quary);
          const result = await cursor.toArray();
          res.send(result)
        })
        // // --------find One product id--------...
    app.get('/parts/:id' , async(req , res )=>{
      const id = req.params.id;
      console.log(id);
      const query = {_id: ObjectId(id)};
      const products = await partsCollection.findOne(query);
      res.send(products);
    })

    // Add single Purchase here
    app.post('/purchase', async (req, res) => {
      const purchase = req.body;
      const query = { purchaseName: purchase.purchaseName, purchaseId: purchase.purchaseId, email: purchase.email }
      const exists = await purchaseCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, purchase: exists })
      }
      const result = await purchaseCollection.insertOne(purchase);
      return res.send({ success: true, result });
    });

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

    // update a new stock available
    app.put('/parts/:id' , async (req ,res) =>{
      const id = req.params.id;
      const quantity = req.body;
      const query = {_id: ObjectId(id)};
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          stock:quantity.newStock
        },
      };
        const result = await partsCollection.updateOne
        (query,updateDoc,options);
        res.send(result) ;
        
    })

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
  // Update user

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