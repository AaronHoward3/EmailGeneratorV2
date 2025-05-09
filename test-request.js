// test-request.js
import fs from "fs";
import axios from "axios";

const payload = JSON.parse(fs.readFileSync("puma-payload.json", "utf-8"));

axios.post("http://localhost:3000/generate-emails", payload, {
  headers: {
    "Content-Type": "application/json"
  }
})
  .then((res) => {
    console.log("✅ Response:", res.data);
  })
  .catch((err) => {
    console.error("❌ Request failed:", err.response?.data || err.message);
  });