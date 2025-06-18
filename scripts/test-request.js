// test-request.js
import fs from "fs";
import axios from "axios";

// Load the base payload
const payload = JSON.parse(fs.readFileSync("test-data/patagonia-payload.json", "utf-8"));

// Send the request
axios
  .post("http://localhost:3000/generate-emails", payload, {
    headers: {
      "Content-Type": "application/json",
    },
  })
  .then((res) => {
    console.log("Response:", res.data);
  })
  .catch((err) => {
    console.error("Request failed:", err.response?.data || err.message);
  });
