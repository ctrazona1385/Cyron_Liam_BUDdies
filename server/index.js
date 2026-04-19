require('dotenv').config();
const app  = require('./app');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`B.U.D. Tracker server running on port ${PORT}`);
});
