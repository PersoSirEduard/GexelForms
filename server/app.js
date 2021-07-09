const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require("helmet");

// Default port is 8081
const port  = process.env.PORT || 8081;

const app = express();
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());

// API routes
require('./routes')(app);

app.listen(port, '0.0.0.0', (err) => { // Start express server
    if (err) {
        console.log(err);
    } else {
        console.info("API server is running! Open http://localhost:%s/ in your browser.", port);
    }
});

module.exports = app;