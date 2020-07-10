const express = require('express');
const multer = require('multer');
var bodyParser = require('body-parser');
var app = express();
app.use(bodyParser.json());
console.log(__dirname)
app.use(express.static(__dirname + '/public'));

const portNumber = 2000;
var storage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, "./upload");
    },
    filename: function (req, file, callback) {
        callback(null, Date.now() + "_" + file.originalname);
    }
});

var upload = multer({
    storage: storage
}).array("docUploader", 3);

app.get("/", function (req, res) {
    res.sendFile(__dirname + "/index.html");
});
app.post("/api/Upload", function (req, res) {
    upload(req, res, function (err) {
        if (err) {
            return res.end("Something went wrong!");
        }
        return res.end("File uploaded sucessfully!.");
    });
});

app.listen(portNumber, function (a) {
    console.log(`Listening to port ${portNumber}`);
});
