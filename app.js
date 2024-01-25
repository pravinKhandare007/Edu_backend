const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const multer = require("multer");
const { json, urlencoded } = require("body-parser");
const cookieParser = require("cookie-parser");
var session = require('express-session');

// const authMiddleware = require('./server/config/authMiddleware');

// Import the routes module
const routes = require('./routes.js');


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        console.log(path.join(__dirname, "./server/uploads/"));
        cb(null, path.join(__dirname, "./server/uploads/"));
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname);
    },
});
const upload = multer({ storage: storage });

dotenv.config();

const app = express();

app.use(session({
    secret: process.env.EXPRESS_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false, // set this to true on production
    }
}));

app.use(cors());
app.use(json());
app.use(urlencoded({ extended: true }));
app.use(cookieParser());

// all environments
app.set("port", process.env.PORT || 3001);
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

// development only
// if (app.get("env") === "development") {
//   app.use(errorHandler());
// }

const cookieDecoder = (req, res, next) => {
    console.log("cookeis", req.headers);
    if (req.headers.accesstoken) {
        console.log(`found access token`);
        const userDetails = jwt.decode(
            req.headers.accesstoken,
            process.env.SECRET_KEY
        );
        console.log("userdetails", userDetails);
        req.body.userDetails = userDetails;
        next();
    } else {
        res.sendStatus(401);
    }
}
    ;
// Mount the routes under the '/api' path
app.use('/api', routes);

function isSuperAdmin(req, res, next) {
    if (req.body.userDetails.role == 0) {
        // User is an admin, continue to the next middleware
        next();
    } else {
        // User is not an admin, redirect to a different page or return an error response
        res.redirect("/");
    }
}

function isAdmin(req, res, next) {
    if (req.body.userDetails.role == 1) {
        // User is an admin, continue to the next middleware
        next();
    } else {
        // User is not an admin, redirect to a different page or return an error response
        res.redirect("/");
    }
}

let userOperations = require("./server/Dao/usersDao.js");
//app.get("/",(req,res)=>{ res.status(200).send("ok")});


app.post("/login", userOperations.userLogin);
app.post("/adminLogin", userOperations.adminLogin);

// app.get(
//     "/getDashboardsByGroupId/:groupId",
//     cookieDecoder,
//     userOperations.getDashboardsByGroupId
// );

const root = path.join(__dirname, "/public");
app.use("/", express.static(root));
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname + "/public/index.html"));
});
// app.use('*', express.static('public'));
app.get("*", (req, res) => {
    let url = path.join(__dirname, "public", "index.html");
    // if (!url.startsWith("/app/"))
    //   // we're on local windows
    //   url = url.substring(1);
    res.sendFile(url);
});


/**
 * On all requests add headers
 **/
var allowCrossDomain = function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
    req.header("Access-Control-Allow-Origin", "*");
    req.header("Access-Control-Allow-Headers", "X-Requested-With");
    req.header("Access-Control-Allow-Headers", "Content-Type");
    req.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
};

//app.configure(function () {
app.use(allowCrossDomain);
//});

////////////////////////////////////////////
http.createServer(app).listen(app.get("port"), function () {
    console.log("Express server listening on port " + app.get("port"));
});
