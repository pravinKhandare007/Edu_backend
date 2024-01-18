
var mySqlConnectionString = {
    connection: {
        dev: {
            host: 'localhost',
            user: 'root',
            password: 'root',
            database: 'education_app_db1',
            port: '3306'
            // host: process.env.HOSTNAME,
            // user: process.env.DBUNAME,
            // password: process.env.DBPASS,
            // database: process.env.DBNAME,
            // port: process.env.DBPORT
        },
        qu: {
            host: 'localhost',
            user: 'root',
            password: 'root',
            database: 'education_app_db1',
            port: '3306'
        }
    }
}

module.exports.mySqlConnectionString = mySqlConnectionString;