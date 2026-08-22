import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import Thread from "./models/Thread.js";

const PORT = 8080;

app.listen(PORT, () => {
  console.log("App is listening on port 8080");
  connectDB();
});

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("MongoDB Connected Successfully");
    await dropStaleIndexes();
  } catch (err) {
    console.log("Failed to connect with DB", err);
  }
};

// One-time cleanup: an older version of the users collection had a unique
// index on a "username" field that no longer exists in the current User
// model. Because every new document has username=null, Mongo's unique
// index rejects every signup after the first as a duplicate key. This
// drops that stale index if it's still present - safe to leave in
// permanently, since it's a no-op once the index is gone.
const dropStaleIndexes = async () => {
  try {
    const usersCollection = mongoose.connection.collection("users");
    const userIndexes = await usersCollection.indexes();
    const hasStaleUsernameIndex = userIndexes.some(idx => idx.name === "username_1");
    if (hasStaleUsernameIndex) {
      await usersCollection.dropIndex("username_1");
      console.log("Dropped stale 'username_1' index from users collection");
    }

    // Same problem, different field: threads.shareId is a unique+sparse
    // index. Sparse indexes only exclude documents where the field is
    // entirely ABSENT - not documents where it's explicitly set to null.
    // The schema used to have `default: null`, which wrote an explicit
    // null onto EVERY thread at creation time, so the sparse index never
    // actually excluded anything and the second-ever thread collided with
    // the first. The schema no longer sets that default, but any threads
    // already saved in the database before this fix still have an
    // explicit shareId: null sitting on them - so we unset it here, once,
    // for any thread that was never actually shared.
    try {
      const { modifiedCount } = await Thread.updateMany(
        { shareId: null },
        { $unset: { shareId: "", sharedAt: "" } }
      );
      if (modifiedCount > 0) {
        console.log(`Migrated ${modifiedCount} thread(s): removed explicit shareId:null so the sparse unique index works correctly`);
      }
    } catch (err) {
      console.log("Could not migrate legacy shareId:null threads:", err.message);
    }
  } catch (err) {
    // Not fatal - log and continue booting either way.
    console.log("Could not check/drop stale indexes:", err.message);
  }
};
