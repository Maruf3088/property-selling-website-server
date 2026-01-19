const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
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

// Collections will be initialized after MongoDB connection
let userCollection, propertyCollection, agencyCollection;

// Helper function to get collections (with connection check)
function getCollections() {
  if (!userCollection || !propertyCollection || !agencyCollection) {
    throw new Error("Database not connected. Please wait...");
  }
  return { userCollection, propertyCollection, agencyCollection };
}
const favouritesCollection = client
  .db("propertySellingDB")
  .collection("favourites");

const appointmentsCollection = client
  .db("propertySellingDB")
  .collection("appointments");

  const reviewsCollection = client
  .db("propertySellingDB")
  .collection("reviews");

// ------------- middlewares  ------------------
const verifyToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = req.headers.authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
  });
  next();
};

const verifyAdmin = async (req, res, next) => {
  try {
    const email = req.decoded.email;

    const user = await userCollection.findOne({ email });

    if (user?.role?.includes("admin")) {
      next();
    } else {
      return res.status(403).send({ message: "forbidden access" });
    }
  } catch (error) {
    console.error("verifyAdmin error:", error);
    res.status(500).send({ message: "Server error" });
  }
};

// ------------- jwt API's  ------------------

app.post("/jwt", (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "1h",
  });
  res.send({ token });
});

// ------------- users API's  ------------------

app.post("/users", async (req, res) => {
  try {
    const { userCollection } = getCollections();
    const user = req.body;
    const query = { email: user.email };
    const alreadyUser = await userCollection.findOne(query);
    if (alreadyUser) {
      return res.send({ message: "User already exists" });
    }

    const result = await userCollection.insertOne(user);
    res.send({
      insertedId: result.insertedId,
      message: "user created successfully",
    });
  } catch (error) {
    console.error("Error in /users:", error);
    res.status(500).send({
      message: error.message || "Failed to create user",
    });
  }
});

app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { userCollection } = getCollections();
    const users = await userCollection.find({}).toArray();
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send({
      message: error.message || "Failed to fetch users",
    });
  }
});

app.get("/users/admin/:email", verifyToken, async (req, res) => {
  const email = req.params.email;
  if (req.decoded.email !== email) {
    return res.status(403).send({ message: "forbidden access" });
  }
  const user = await userCollection.findOne({ email: email });
  const isAdmin = user?.role?.includes("admin") || false;

  res.send({ admin: isAdmin });
});

app.patch("/users/admin/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { userCollection } = getCollections();
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $addToSet: { role: "admin" },
    };
    const result = await userCollection.updateOne(filter, updateDoc);
    res.send(result);
  } catch (error) {
    console.error("Error in /users/admin/:id:", error);
    res.status(500).send({
      message: error.message || "Failed to make admin",
    });
  }
});

app.patch(
  "/users/remove-admin/:id",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const { userCollection } = getCollections();
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $pull: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    } catch (error) {
      console.error("Error in /users/remove-admin/:id:", error);
      res.status(500).send({
        message: error.message || "Failed to remove admin",
      });
    }
  },
);

app.delete(
  "/users/deleteuser/:id",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const { userCollection } = getCollections();
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(filter);
      res.send(result);
    } catch (error) {
      console.error("Error in DELETE /users/:id:", error);
      res.status(500).send({
        message: error.message || "Failed to delete user",
      });
    }
  },
);

// ------------- agencies API's  ------------------

// GET all agencies
app.get("/agencies", async (req, res) => {
  try {
    const { agencyCollection } = getCollections();
    const agencies = await agencyCollection.find({}).toArray();
    res.status(200).json(agencies);
  } catch (error) {
    console.error("Error fetching agencies:", error);
    res.status(500).send({
      message: error.message || "Failed to fetch agencies",
    });
  }
});

// GET single agency by ID
app.get("/agencies/:id", verifyToken, async (req, res) => {
  try {
    const { agencyCollection } = getCollections();
    const id = req.params.id;
    const agency = await agencyCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!agency) {
      return res.status(404).send({
        message: "Agency not found",
      });
    }

    res.status(200).json(agency);
  } catch (error) {
    console.error("Error fetching agency:", error);
    if (error.message && error.message.includes("ObjectId")) {
      return res.status(400).send({
        message: "Invalid agency ID format",
      });
    }
    res.status(500).send({
      message: error.message || "Failed to fetch agency",
    });
  }
});

app.post("/agencies", verifyToken, async (req, res) => {
  try {
    const agencyData = req.body;
    const email = agencyData.email;
    const query = { email: email };
    const alreadyAgency = await agencyCollection.findOne(query);
    if (alreadyAgency) {
      return res.send({
        message: "Agency already exists",
        id: alreadyAgency._id,
      });
    }
    const result = await agencyCollection.insertOne(agencyData);
    res.send({
      insertedId: result.insertedId,
      message: "Agency added successfully",
    });
  } catch (error) {
    console.error("Error in /agencies:", error);
    res.send({
      message: error.message || "Failed to add agency",
    });
  }
});

// DELETE agency by ID
app.delete("/agencies/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { agencyCollection, propertyCollection } = getCollections();
    const agencyId = req.params.id;

    // Delete all properties associated with this agency
    await propertyCollection.deleteMany({ agencyId: agencyId });

    // Delete the agency
    const result = await agencyCollection.deleteOne({
      _id: new ObjectId(agencyId),
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        message: "Agency not found",
      });
    }

    res.send({
      deletedCount: result.deletedCount,
      message: "Agency and associated properties deleted successfully",
    });
  } catch (error) {
    console.error("Error in DELETE /agencies/:id:", error);
    res.status(500).send({
      message: error.message || "Failed to delete agency",
    });
  }
});

// ------------- properties API's  ------------------

// POST property with agency ID
app.post("/properties", verifyToken, async (req, res) => {
  const propertyData = req.body;

  // Convert numeric fields (handle empty strings and NaN)
  if (propertyData.details) {
    if (propertyData.details.beds && propertyData.details.beds !== "") {
      const bedsNum = parseInt(propertyData.details.beds);
      propertyData.details.beds = isNaN(bedsNum) ? "" : bedsNum;
    } else {
      propertyData.details.beds = "";
    }
    if (propertyData.details.baths && propertyData.details.baths !== "") {
      const bathsNum = parseInt(propertyData.details.baths);
      propertyData.details.baths = isNaN(bathsNum) ? "" : bathsNum;
    } else {
      propertyData.details.baths = "";
    }
    if (propertyData.details.belcony && propertyData.details.belcony !== "") {
      const belconyNum = parseInt(propertyData.details.belcony);
      propertyData.details.belcony = isNaN(belconyNum) ? "" : belconyNum;
    } else {
      propertyData.details.belcony = "";
    }
    if (propertyData.details.area && propertyData.details.area !== "") {
      const areaNum = parseFloat(propertyData.details.area);
      propertyData.details.area = isNaN(areaNum) ? "" : areaNum;
    } else {
      propertyData.details.area = "";
    }
  }

  // Ensure price is a number (handle NaN)
  const priceNum = Number(propertyData.price);
  if (isNaN(priceNum) || priceNum <= 0) {
    return res.status(400).send({
      message: "Invalid price. Please provide a valid positive number.",
    });
  }
  propertyData.price = priceNum;

  // Add timestamp if not provided
  if (!propertyData.createdAt) {
    propertyData.createdAt = new Date().toISOString();
  }

  const agencyEmail = propertyData.agencyEmail;
  const query = { email: agencyEmail };
  const agency = await agencyCollection.findOne(query);
  if (agency) {
    propertyData.agencyId = new ObjectId(agency._id);
  } else {
    const agencyData = {
      agencyName: propertyData.agency.agencyName,
      email: agencyEmail,
      location: propertyData.agency.location,
      title: propertyData.agency.title,
      logoUrl: propertyData.agency.logoUrl,
    };
    const result = await agencyCollection.insertOne(agencyData);
    propertyData.agencyId = result.insertedId;
  }

  const result = await propertyCollection.insertOne(propertyData);
  res.send({
    insertedId: result.insertedId,
    message: "Property added successfully",
  });
});

app.get("/allProperties", async (req, res) => {
  try {
    const { propertyCollection } = getCollections();
    const {
      propertyStatus,
      propertyType,
      beds,
      baths,
      belcony,
      minPrice,
      maxPrice,
      isFeatured,
      minArea,
      maxArea,
    } = req.query;

    // Build query object
    const query = {
      isAdminAproved: "approved", // ✅ Only admin-approved properties
    };

    // Top-level string filters
    if (propertyStatus) query.propertyStatus = propertyStatus;
    if (propertyType) query.propertyType = propertyType;

    // Details numeric filters
    if (beds) query["details.beds"] = parseInt(beds);
    if (baths) query["details.baths"] = parseInt(baths);
    if (belcony) query["details.belcony"] = parseInt(belcony);
    if (isFeatured) query.isFeatured = Boolean(isFeatured);

    // Price filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseInt(minPrice);
      if (maxPrice) query.price.$lte = parseInt(maxPrice);
      if (Object.keys(query.price).length === 0) delete query.price; // remove empty object
    }

    // Area filter
    if (minArea || maxArea) {
      query["details.area"] = {};
      if (minArea) query["details.area"].$gte = parseInt(minArea);
      if (maxArea) query["details.area"].$lte = parseInt(maxArea);
      if (Object.keys(query["details.area"]).length === 0)
        delete query["details.area"]; // remove empty object
    }

    // console.log("MongoDB Query:", query); // Debug: see the final query

    // Fetch from MongoDB
    const result = await propertyCollection.find(query).toArray();

    res.status(200).json(result);
  } catch (error) {
    console.error("Error in /allProperties:", error);
    res.status(500).json({
      message: error.message || "Database not connected",
    });
  }
});

app.get("/allProperties/agency/:agencyId", verifyToken, async (req, res) => {
  try {
    const { propertyCollection } = getCollections();
    const agencyId = req.params.agencyId;
    const query = {
      agencyId: new ObjectId(agencyId),
      isAdminAproved: "approved",
    };
    const result = await propertyCollection.find(query).toArray();
    res.send(result);
  } catch (error) {
    console.error("Error in /allProperties/agency/:agencyId:", error);
    res.status(500).send({
      message: error.message || "Database not connected",
    });
  }
});

app.get("/admin/allProperties", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { propertyCollection } = getCollections();
    const result = await propertyCollection.find().toArray();
    res.send(result);
  } catch (error) {
    console.error("Error in /admin/allProperties:", error);
    res.status(500).json({
      message: error.message || "Database not connected",
    });
  }
});

app.get("/properties/types", async (req, res) => {
  try {
    const { propertyCollection } = getCollections();
    const types = await propertyCollection
      .aggregate([
        { $group: { _id: "$propertyType" } },
        { $project: { _id: 0, propertyType: "$_id" } },
      ])
      .toArray();

    res.json(types.map((t) => t.propertyType));
  } catch (error) {
    console.error("Error in /properties/types:", error);
    res.status(500).send({
      message: error.message || "Database not connected",
    });
  }
});

// count property according to agency
app.get("/properties/countProperty", async (req, res) => {
  try {
    const { propertyCollection } = getCollections();
    const { agencyName, agencyId } = req.query;

    let query = { isAdminAproved: "approved" };

    if (agencyId) {
      // Count by agencyId (for direct agency objects)
      try {
        query.agencyId = new ObjectId(agencyId);
      } catch (idError) {
        return res.status(400).send({ message: "Invalid agencyId format" });
      }
    } else if (agencyName) {
      // Count by agencyName (for nested agency in properties)
      query["agency.agencyName"] = { $regex: `^${agencyName}$`, $options: "i" };
    } else {
      return res.status(400).send({
        message: "Either agencyName or agencyId is required",
      });
    }

    const count = await propertyCollection.countDocuments(query);

    res.send({ count });
  } catch (error) {
    console.error("Error in /properties/countProperty:", error);
    res.status(500).send({
      message: error.message || "Database not connected",
    });
  }
});

app.get("/properties/countByPropertyId", async (req, res) => {
  try {
    const { propertyCollection } = getCollections();
    const { propertyId } = req.query;
    const query = { propertyId};
    const count = await appointmentsCollection.countDocuments(query);
    res.send({ count });
  } catch (error) {
    console.error("Error in /properties/countByPropertyId:", error);
    res.status(500).send({
      message: error.message || "Database not connected",
    });
  }
});

app.get("/allProperties/:id", verifyToken, async (req, res) => {
  try {
    const { propertyCollection } = getCollections();
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await propertyCollection.findOne(query);
    res.send(result);
  } catch (error) {
    console.error("Error in /allProperties/:id:", error);
    res.status(500).send({
      message: error.message || "Database not connected",
    });
  }
});

app.get("/allProperties/user/:email", verifyToken, async (req, res) => {
  try {
    const { propertyCollection } = getCollections();
    const email = req.params.email;

    const result = await propertyCollection
      .find({ "agent.email": email })
      .toArray();

    res.send(result);
  } catch (error) {
    console.error("Error in /allProperties/:email:", error);
    res.status(500).send({
      message: error.message || "Server error",
    });
  }
});

app.patch("/allProperties/:id", verifyToken, async (req, res) => {
  try {
    const { propertyCollection, userCollection } = getCollections();
    const id = req.params.id;
    const updatedData = req.body;
    const userEmail = req.decoded.email;

    // Check if user is admin
    const user = await userCollection.findOne({ email: userEmail });
    const isAdmin = user?.role?.includes("admin");

    // Convert numeric fields if present
    if (updatedData.details) {
      if (updatedData.details.beds && updatedData.details.beds !== "") {
        const bedsNum = parseInt(updatedData.details.beds);
        updatedData.details.beds = isNaN(bedsNum) ? "" : bedsNum;
      }
      if (updatedData.details.baths && updatedData.details.baths !== "") {
        const bathsNum = parseInt(updatedData.details.baths);
        updatedData.details.baths = isNaN(bathsNum) ? "" : bathsNum;
      }
      if (updatedData.details.belcony && updatedData.details.belcony !== "") {
        const belconyNum = parseInt(updatedData.details.belcony);
        updatedData.details.belcony = isNaN(belconyNum) ? "" : belconyNum;
      }
      if (updatedData.details.area && updatedData.details.area !== "") {
        const areaNum = parseFloat(updatedData.details.area);
        updatedData.details.area = isNaN(areaNum) ? "" : areaNum;
      }
    }

    // Ensure price is a number
    if (updatedData.price) {
      const priceNum = Number(updatedData.price);
      if (isNaN(priceNum) || priceNum <= 0) {
        return res.status(400).send({
          message: "Invalid price. Please provide a valid positive number.",
        });
      }
      updatedData.price = priceNum;
    }

    // Handle isAdminAproved field
    if (!isAdmin) {
      // If not admin, set to pending
      updatedData.isAdminAproved = "pending";
    } else {
      // If admin, remove it from updatedData so existing value is preserved
      delete updatedData.isAdminAproved;
    }
    updatedData.agencyId = new ObjectId(updatedData.agencyId);

    if (updatedData.agencyId) {
      const agencyId = new ObjectId(updatedData.agencyId);
      const query = { _id: new ObjectId(agencyId) };
      const agency = await agencyCollection.findOne(query);
      if (agency) {
        const updatedAgencyData = {
          agencyName: updatedData.agency.agencyName,
          email: updatedData.agencyEmail,

          location: updatedData.agency.location,
          title: updatedData.agency.title,
          logoUrl: updatedData.agency.logoUrl,
        };
        await agencyCollection.updateOne(
          { _id: new ObjectId(agencyId) },
          { $set: updatedAgencyData },
        );
      } else {
        return res.status(400).send({
          message: "Invalid agencyId. Agency does not exist.",
        });
      }
    }

    const filter = { _id: new ObjectId(id) };
    const result = await propertyCollection.updateOne(filter, {
      $set: updatedData,
    });

    if (result.matchedCount === 0) {
      return res.status(404).send({
        message: "Property not found",
      });
    }

    res.send({
      success: true,
      message: "Property updated successfully",
      result,
    });
  } catch (error) {
    console.error("Error in PATCH /allProperties/:id:", error);
    res.status(500).send({
      message: error.message || "Failed to update property",
    });
  }
});

app.patch(
  "/properties/approve/:id",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const { propertyCollection } = getCollections();
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { isAdminAproved: "approved" },
      };
      const result = await propertyCollection.updateOne(filter, updateDoc);
      res.send(result);
    } catch (error) {
      console.error("Error in /properties/approve/:id:", error);
      res.status(500).send({
        message: error.message || "Database not connected",
      });
    }
  },
);
app.patch(
  "/properties/pending/:id",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const { propertyCollection } = getCollections();
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { isAdminAproved: "pending" },
      };
      const result = await propertyCollection.updateOne(filter, updateDoc);
      res.send(result);
    } catch (error) {
      console.error("Error in /properties/pending/:id:", error);
      res.status(500).send({
        message: error.message || "Database not connected",
      });
    }
  },
);
app.patch(
  "/properties/reject/:id",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const { propertyCollection } = getCollections();
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { isAdminAproved: "rejected" },
      };
      const result = await propertyCollection.updateOne(filter, updateDoc);
      res.send(result);
    } catch (error) {
      console.error("Error in /properties/reject/:id:", error);
      res.status(500).send({
        message: error.message || "Database not connected",
      });
    }
  },
);

app.delete(
  "/properties/delete/:id",
  verifyToken,

  async (req, res) => {
    try {
      const { propertyCollection } = getCollections();
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await propertyCollection.deleteOne(filter);
      res.send(result);
    } catch (error) {
      console.error("Error in DELETE /properties/:id:", error);
      res.status(500).send({
        message: error.message || "Failed to delete property",
      });
    }
  },
);

app.patch ('/properties/status/:id', verifyToken, async (req, res) => {
  try {
    const { propertyCollection } = getCollections();
    const id = req.params.id;
    const { status } = req.body;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: { propertyStatus: status },
    };
    const result = await propertyCollection.updateOne(filter, updateDoc);
    res.send(result);
  } catch (error) {
    console.error("Error in /properties/status/:id:", error);
    res.status(500).send({
      message: error.message || "Database not connected",
    });
  }
});

// ------------- favourites API's  ------------------
app.post("/favourites", verifyToken, async (req, res) => {
  try {
    const { propertyId, email, propertyName, price, thumbnail } = req.body;

    const exists = await favouritesCollection.findOne({ propertyId, email });
    if (exists) {
      return res.send({ message: "Already favourited" });
    }

    const result = await favouritesCollection.insertOne({
      propertyId,
      email,
      propertyName,
      price,
      thumbnail,
      createdAt: new Date(),
    });

    res.send(result);
  } catch (err) {
    res.status(500).send({ message: "Server error" });
  }
});

app.delete("/favourites", verifyToken, async (req, res) => {
  try {
    const { propertyId, email } = req.body;

    const result = await favouritesCollection.deleteOne({
      propertyId,
      email,
    });

    res.send(result);
  } catch (err) {
    res.status(500).send({ message: "Server error" });
  }
});

// GET user's favourites
app.get("/favourites", verifyToken, async (req, res) => {
  try {
    const email = req.query.email;
    const result = await favouritesCollection.find({ email }).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: "Server error" });
  }
});

// ------------------------appointment API's ----------------------------
app.post("/appointments", verifyToken, async (req, res) => {
  // Implementation for creating an appointment
  const appointment = req.body;

  const propertyId = appointment.propertyId;
  const query = { propertyId: propertyId, buyerEmail: appointment.buyerEmail };
  const exists = await appointmentsCollection.findOne(query);
  if (exists) {
    return res.send({ exists: "Appointment already exists" });
  }

  const result = await appointmentsCollection.insertOne(appointment);
  res.send({
    insertedId: result.insertedId,
    message: "Appointment created successfully",
  });
});

app.get("/appointments/buyer/:email", verifyToken, async (req, res) => {
  const email = req.params.email;
  const query = { buyerEmail: email };
  const result = await appointmentsCollection.find(query).toArray();
  res.send(result);
});

app.delete("/appointments/:id", verifyToken, async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await appointmentsCollection.deleteOne(query);
  res.send(result);
});

app.get('/appointments/property/:propertyId', verifyToken, async (req, res) => {
  const propertyId = req.params.propertyId;
  const query = { propertyId: propertyId };
  const result = await appointmentsCollection.find(query).toArray();
  res.send(result);
}
);

app.patch("/appointments/status/:id", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const { status, agentMessage } = req.body;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: { status: status, agentMessage: agentMessage },
    };
    const result = await appointmentsCollection.updateOne(filter, updateDoc);
    res.send(result);
  } catch (error) {
    console.error("Error in /appointments/status/:id:", error);
    res.status(500).send({
      message: error.message || "Database not connected",
    });
  }
});

// ------------------------ end of appointment API's ----------------------------
// ------------------------ reviews API's ----------------------------

app.post("/reviews", verifyToken, async (req, res) => {
  const review = req.body;
  const result = await reviewsCollection.insertOne(review);
  res.send({
    insertedId: result.insertedId,
    message: "Review added successfully",
  });
});
app.get("/reviews/property/:propertyId", verifyToken, async (req, res) => {
  const propertyId = req.params.propertyId;
  const query = { propertyId: propertyId };
  const result = await reviewsCollection.find(query).toArray();
  res.send(result);
});

// ------------------------ end of reviews API's ----------------------------

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );

    userCollection = client.db("propertySellingDB").collection("users");
    propertyCollection = client
      .db("propertySellingDB")
      .collection("properties");
    agencyCollection = client.db("propertySellingDB").collection("agencies");

    console.log("Collections initialized. Routes are now active.");
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
