import express from "express";
import { SocialClient, ZnsClient } from "../src"; 
import * as dotenv from "dotenv";

dotenv.config();

const app = express();
const port = 3000;

app.use(express.json());

// Token mặc định từ file .env. Hoặc bạn paste cứng giá trị string ở đây.
const defaultAccessToken = process.env.USER_ACCESS_TOKEN || "PASTE_YOUR_USER_ACCESS_TOKEN_HERE";
const defaultOaToken = process.env.OA_ACCESS_TOKEN || "PASTE_YOUR_OA_ACCESS_TOKEN_HERE";

if (defaultAccessToken === "PASTE_YOUR_USER_ACCESS_TOKEN_HERE") {
  console.warn("⚠️ CẢNH BÁO: Tạm thiếu USER_ACCESS_TOKEN (Dùng cho API của SocialClient)");
}

if (defaultOaToken === "PASTE_YOUR_OA_ACCESS_TOKEN_HERE") {
  console.warn("⚠️ CẢNH BÁO: Tạm thiếu OA_ACCESS_TOKEN (Dùng cho gửi tin nhắn ZNS)");
}

const client = new SocialClient(defaultAccessToken);
const znsClient = new ZnsClient(defaultOaToken);

app.get("/profile", async (req, res) => {
  try {
    // Nếu thiết kế API cho nhiều user, cho phép truyền Token qua header Authorization:
    // const dynamicClient = new SocialClient(req.headers.authorization || defaultAccessToken);

    const profile = await client.getProfile(["id", "name", "picture", "gender", "birthday"]);
    res.json({ success: true, data: profile });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/friends", async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;
    const friends = await client.getFriends(offset, limit, ["id", "name", "picture"]);
    res.json({ success: true, data: friends });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/app-request", async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) {
      res.status(400).json({ success: false, error: "Missing 'to' or 'message' in body" });
      return; 
    }
    await client.sendAppRequest(to, message);
    res.json({ success: true, message: "App request sent!" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/feed", async (req, res) => {
  try {
    const { message, link } = req.body;
    if (!message) {
      res.status(400).json({ success: false, error: "Missing 'message' in body" });
      return; 
    }
    await client.postFeed(message, { link });
    res.json({ success: true, message: "Feed posted!" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ZNS Endpoint (Sử dụng OA Token)
app.post("/zns", async (req, res) => {
  try {
    const { phone, user_id, template_id, template_data } = req.body;
    
    if (!template_id || !template_data) {
      res.status(400).json({ success: false, error: "Missing 'template_id' or 'template_data'" });
      return;
    }

    let result;
    if (phone) {
      result = await znsClient.sendTemplateMessageByPhone(phone, template_id, template_data);
    } else if (user_id) {
      result = await znsClient.sendTemplateMessageByUserId(user_id, template_id, template_data);
    } else {
      res.status(400).json({ success: false, error: "Must provide either 'phone' or 'user_id'" });
      return;
    }

    res.json({ success: true, api_response: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 API Server đang chạy tại http://localhost:${port}`);
  console.log(`\nCác REST Endpoints hiện có:`);
  console.log(`  GET  http://localhost:${port}/profile`);
  console.log(`  GET  http://localhost:${port}/friends?limit=20&offset=0`);
  console.log(`  POST http://localhost:${port}/app-request  (body: { "to": "mã_bạn_bè", "message": "hello!" })`);
  console.log(`  POST http://localhost:${port}/feed         (body: { "message": "hello", "link": "https://zing.vn" })`);
  console.log(`\n--- GỬI TIN BẰNG ZNS (Cần OA Access Token) ---`);
  console.log(`  POST http://localhost:${port}/zns`);
  console.log(`       Gửi qua SĐT: { "phone": "849xxxx", "template_id": "123", "template_data": {"name":"John"} }`);
  console.log(`       Gửi qua UID: { "user_id": "123x", "template_id": "123", "template_data": {"name":"John"} }`);
});
