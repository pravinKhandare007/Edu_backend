var mysql = require("mysql2");
var mysqlConnectionString = require("./mySqlConnectionString.js");
var mysqlConnectionStringProvider = {
    getMysqlConnection: function () {
        // console.log("Hostname:", process.env.HOSTNAME);
        // console.log("DB Username:", process.env.DBUNAME);
        // console.log("DB Password:", process.env.DBPASS);
        // console.log("Database Name:", process.env.DBNAME);
        var connection = mysql.createConnection(
            mysqlConnectionString.mySqlConnectionString.connection.dev
        );
        connection.connect(function (err) {
            if (err) {
                console.log("ERRRRORO", err)
                throw err;
            }
            console.log("Connected Successfully...");
        });
        return connection;
    },
    closeMysqlConnection: function (currentConnection) {
        if (currentConnection) {
            currentConnection.end(function (err) {
                if (err) {
                    throw err;
                }
                console.log("Connection closed Successfully...");
            });
        }
    },
};
module.exports.mysqlConnectionStringProvider = mysqlConnectionStringProvider;
