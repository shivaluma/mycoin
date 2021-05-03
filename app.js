const express = require("express")
const compression = require("compression")
const app = express()

app.use(express.json())
app.use(compression())

const PORT = process.env.PORT || 3000;

app.use("/", (req, res) => {
  return res.send("hihi")
})

app.listen(PORT, () => {
  console.log("Server is listen on port : " + PORT);
})