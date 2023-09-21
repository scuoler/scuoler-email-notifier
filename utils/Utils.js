const pg = require("pg");

function pad(num) {
  num = num < 10 ? "0".concat(num) : "".concat(num);
  return num;
}

function getUniqueId(userId) {
  var v = new Date();
  var day = v.getDate();
  day = pad(day);

  var mon = v.getMonth();
  mon += 1;
  mon = pad(mon);

  var year = v.getFullYear();
  year = pad(year);

  var hour = v.getHours();
  hour = pad(hour);

  var minute = v.getMinutes();
  minute = pad(minute);

  var second = v.getSeconds();
  second = pad(second);

  //console.log(day+'month:'+mon+'year:'+year);
  var str = userId
    .concat(mon)
    .concat(day)
    .concat(year)
    .concat(hour)
    .concat(minute)
    .concat(second);

  return str;
}

exports.getUniqueId = getUniqueId;

const whiteListedIps = ["73.209.26.15", "127.0.0.1", "150.136.243.153"];
exports.setCorsHeaders = function (req, res) {
  whiteListedIps.forEach((val) => {
    if (req.ip.includes(val)) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Allow-Credentials", true);
      return;
    }
  });
};

exports.getConfiguration = function (account_id, configuration) {
  var pool = new pg.Pool({
    host: configuration.getHost(),
    user: configuration.getUserId(),
    password: configuration.getPassword(),
    database: configuration.getConfigDatabase(),
    port: configuration.getPort(),
    ssl: { rejectUnauthorized: false },
  });

  var sql =
    "select distinct A.server,  A.port, A.database, A.user_id, A.password " +
    " from account_connection A " +
    " where A.deleted=false and A.account_id=$1 ";

  return new Promise((resolve, reject) => {
    pool.query(sql, [account_id], (err, result, fields) => {
      pool.end(() => {});

      let configurationClone = { ...configuration };
      if (err) resolve(configurationClone);
      else {
        if (result && result.rows && result.rows.length > 0) {
          configurationClone.host = result.rows[0].server;
          configurationClone.port = result.rows[0].port;
          configurationClone.database = result.rows[0].database;
          configurationClone.userId = result.rows[0].user_id;
          configurationClone.password = result.rows[0].password;
        }
        resolve(configurationClone);
      }
    });
  });
};
const padL = (nr, len = 2, chr = `0`) => `${nr}`.padStart(2, chr);

exports.convertDateToString = (dt) => {
  return `${dt.getFullYear()}-${padL(dt.getMonth() + 1)}-${padL(
    dt.getDate()
  )}T${padL(dt.getHours())}:${padL(dt.getMinutes())}:${padL(dt.getSeconds())}`;
};

/*
offsets the input date object with the input hours and minutes,
1st param- Date object, 2nd parm: Number hours to add/subtract
2nd parm: Number minutes to add/subtract*/
exports.dateAddHoursMinutes = (d, hours, minutes) => {
  let dateTimeMillis = d.getTime();
  dateTimeMillis += hours * 60 * 60 * 1000;
  dateTimeMillis += minutes * 60 * 1000;
  return new Date(dateTimeMillis);
};

/*
offsets the input date object with the input hours,
1st param- Date object, 2nd parm: Number hours to add/subtract*/
exports.dateAddHours = (d, hours) => {
  let dateTimeMillis = d.getTime();
  dateTimeMillis += hours * 60 * 60 * 1000;
  return new Date(dateTimeMillis);
};

/*
offsets the input date object with the input minutes,
1st param- Date object, 2nd parm: Number minutes to add/subtract*/
exports.dateAddMinutes = (d, minutes) => {
  let dateTimeMillis = d.getTime();
  dateTimeMillis += minutes * 60 * 1000;
  return new Date(dateTimeMillis);
};
