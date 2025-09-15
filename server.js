import express from 'express';
import cors from 'cors';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import NaverMapCrawler from './crawler-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// 크롤러 인스턴스
let crawler = null;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database setup
let db;

async function initializeDB() {
  db = await open({
    filename: './database.db',
    driver: sqlite3.Database
  });

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS searches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL,
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS places (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      search_id INTEGER,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      category TEXT,
      rating REAL,
      url TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (search_id) REFERENCES searches (id)
    )
  `);

  console.log('Database initialized');
}

// Routes

// Get all searches
app.get('/api/searches', async (req, res) => {
  try {
    const searches = await db.all(
      'SELECT * FROM searches ORDER BY created_at DESC'
    );
    res.json(searches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new search
app.post('/api/searches', async (req, res) => {
  try {
    const { query, category } = req.body;
    const result = await db.run(
      'INSERT INTO searches (query, category) VALUES (?, ?)',
      [query, category]
    );
    res.json({ id: result.lastID, query, category });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all places
app.get('/api/places', async (req, res) => {
  try {
    const { search_id } = req.query;
    let query = 'SELECT * FROM places';
    const params = [];

    if (search_id) {
      query += ' WHERE search_id = ?';
      params.push(search_id);
    }

    query += ' ORDER BY created_at DESC';

    const places = await db.all(query, params);
    res.json(places);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new place
app.post('/api/places', async (req, res) => {
  try {
    const { search_id, name, address, phone, category, rating, url, notes } = req.body;

    const result = await db.run(
      `INSERT INTO places (search_id, name, address, phone, category, rating, url, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [search_id, name, address, phone, category, rating, url, notes]
    );

    res.json({
      id: result.lastID,
      search_id,
      name,
      address,
      phone,
      category,
      rating,
      url,
      notes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update place
app.put('/api/places/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, phone, category, rating, url, notes } = req.body;

    await db.run(
      `UPDATE places
       SET name = ?, address = ?, phone = ?, category = ?, rating = ?, url = ?, notes = ?
       WHERE id = ?`,
      [name, address, phone, category, rating, url, notes, id]
    );

    res.json({ id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete place
app.delete('/api/places/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM places WHERE id = ?', [id]);
    res.json({ message: 'Place deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 자동 크롤링 엔드포인트
app.post('/api/crawl', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: '검색어가 필요합니다' });
    }

    console.log(`크롤링 요청: ${query}`);

    // 매번 새로운 크롤러 인스턴스 생성
    const currentCrawler = new NaverMapCrawler();
    await currentCrawler.init();

    // 크롤링 실행
    const places = await currentCrawler.searchPlaces(query);

    // 크롤러 정리
    await currentCrawler.close();

    if (places.length === 0) {
      return res.json({
        message: '검색 결과가 없습니다',
        places: [],
        query
      });
    }

    // 검색 기록 저장
    const searchResult = await db.run(
      'INSERT INTO searches (query, category) VALUES (?, ?)',
      [query, '자동']
    );
    const searchId = searchResult.lastID;

    // 장소들 저장
    const savedPlaces = [];
    for (const place of places) {
      const result = await db.run(
        `INSERT INTO places (search_id, name, address, phone, category, rating, url, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [searchId, place.name, place.address || '', place.phone || '', '음식점', null, '', `자동 수집: ${query}`]
      );

      savedPlaces.push({
        id: result.lastID,
        ...place,
        search_id: searchId
      });
    }

    res.json({
      message: `${places.length}개 장소를 자동으로 수집했습니다`,
      places: savedPlaces,
      query
    });

  } catch (error) {
    console.error('크롤링 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
async function startServer() {
  await initializeDB();

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Open your browser and go to http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);