const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// DB_USER = property_selling_website
// DB_PASS = vkk7Z2sFFuXCaL8c

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1gjqpi3.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    const userCollection = client.db("propertySellingDB").collection("users");
    const propertyCollection = client
      .db("propertySellingDB")
      .collection("properties");

    // ------------- users API's  ------------------

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const alreadyUser = await userCollection.findOne(query);
      if (alreadyUser) {
        return res.status(409).send({ message: "User already exists" });
      }

      const result = await userCollection.insertOne(user);
      res.send({
        insertedId: result.insertedId,
        message: "user created successfully",
      });
    });
    // ------------- properties API's  ------------------


    app.get("/allProperties", async (req, res) => {
      const query = {};
      const result = await propertyCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/allProperties/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await propertyCollection.findOne(query);
      res.send(result);
    });

























  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Property Selling Website Server is running");
});

app.listen(port, () => {
  console.log(`Property Selling Website Server is running on port: ${port}`);
});
