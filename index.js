require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const ipamRouter = require('./routes/ipam');
app.use('/ipam', ipamRouter);

const vlansRouter = require('./routes/vlans');
app.use('/vlans', vlansRouter);

const devicesRouter = require('./routes/devices');
app.use('/devices', devicesRouter);

const topologyRouter = require('./routes/topology');
app.use('/topology', topologyRouter);

app.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.render('index', { 
      title: 'Netgrid Dashboard',
      currentPath: '/',
      dbTime: result.rows[0].now 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database connection failed.');
  }
});

app.listen(port, () => {
  console.log(`Netgrid running on port ${port}`);
});
