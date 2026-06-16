import express from "express";
import cors from "cors";

const app = express();

app.use(cors());

const NEXON_API_KEY = process.env.NEXON_API_KEY;

app.get("/api/check", async (req, res) => {
  const { name } = req.query;

  if (!name) {
    return res.status(400).json({
      error: "닉네임 파라미터가 없습니다."
    });
  }

  try {
    const nexonUrl =
      `https://open.api.nexon.com/maplestory/v1/id?character_name=${encodeURIComponent(name)}`;

    const response = await fetch(nexonUrl, {
      headers: {
        "x-nxopen-api-key": NEXON_API_KEY
      }
    });

    const data = await response.json();

    if (response.status === 200) {
      return res.status(200).json(data);
    }

    if (response.status === 400) {
      return res.status(404).json({
        message: "사용 가능한 닉네임입니다."
      });
    }

    return res.status(response.status).json(data);

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: "서버 통신 오류",
      details: error.message
    });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});