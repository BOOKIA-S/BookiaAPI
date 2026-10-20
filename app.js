// Express application (no DB connection, no listen) so tests can import it directly.
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const apiRoutes = require('./routes');
const { CLIENT_URL } = require('./config/env');
const { sanitizeBody } = require('./middlewares/validation');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const JSON_BODY_LIMIT = '100kb';

const app = express();

app.use(helmet());
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(cookieParser());
app.use(sanitizeBody);

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
