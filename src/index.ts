import express, { Request, Response } from "express";
import { Pool } from "pg";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

// Подключение к базе данных PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || "5432", 10),
});

const app = express();
const allowedOrigins = [
  "https://snake-xx.netlify.app",
  "http://localhost:4000",
];

const corsOptions: cors.CorsOptions = {
  // origin: (origin, callback) => {
  //   if (allowedOrigins.includes(origin!) || !origin) {
  //     callback(null, true);
  //   } else {
  //     callback(new Error("Not allowed by CORS"));
  //   }
  // },
  origin: true,
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Функция для проверки и создания таблицы при ее отсутствии
const checkAndCreateTable = async () => {
  try {
    const tableCheckQuery = `
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'results'
            );
        `;
    const tableCheckResult = await pool.query(tableCheckQuery);
    const tableExists = tableCheckResult.rows[0].exists;

    if (!tableExists) {
      const createTableQuery = `
                CREATE TABLE results (
                    id SERIAL PRIMARY KEY,
                    player_name VARCHAR(50) UNIQUE NOT NULL,
                    score INT NOT NULL
                );
            `;
      await pool.query(createTableQuery);
      console.log("Table 'results' created.");
    } else {
      console.log("Table 'results' already exists.");
    }
  } catch (err) {
    console.error("Error checking or creating table:", err);
  }
};

// Эндпоинт 1: Проверка наличия игрока в таблице результатов
app.get("/check-player/:playerName", async (req: Request, res: Response) => {
  const { playerName } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM results WHERE player_name = $1",
      [playerName]
    );
    if (result.rows.length > 0) {
      res.status(200).send(`Player ${playerName} exists.`);
    } else {
      res.status(404).send(`Player ${playerName} does not exist.`);
    }
  } catch (err) {
    res.status(500).send("Error checking player.");
  }
});

// Эндпоинт 2: Прием данных игрока о результатах игры и их запись
app.post("/add-result", async (req: Request, res: Response) => {
  const { playerName, score } = req.body;
  console.log("add-result: ", req.body);
  try {
    const result = await pool.query(
      `INSERT INTO results (player_name, score) 
       VALUES ($1, $2) 
       ON CONFLICT (player_name) 
       DO UPDATE SET score = GREATEST(results.score, EXCLUDED.score)
       RETURNING *`,
      [playerName, score]
    );
    res.status(201).send(`Player ${playerName}'s score added/updated.`);
  } catch (err) {
    console.error("Error adding/updating result:", err);
    res.status(500).send("Error adding/updating result.");
  }
});

// Эндпоинт 3: Вывод таблицы лучших результатов игроков
app.get("/top-results", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM results ORDER BY score DESC LIMIT 10"
    );
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).send("Error fetching top results.");
  }
});

// Запуск сервера и проверка таблицы
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  await checkAndCreateTable(); // Проверка и создание таблицы при запуске сервера
});
