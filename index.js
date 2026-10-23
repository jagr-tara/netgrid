require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.render('index', { dbTime: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database connection failed.');
  }
});

app.listen(port, () => {
  console.log(`Netgrid running on port ${port}`);
});
