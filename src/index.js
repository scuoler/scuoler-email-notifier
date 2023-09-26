const pg = require("pg");
const cron = require("node-cron");

const configuration = require("../Configuration");
const utils = require("../utils/Utils");
const constants = require("../Constants");

const sendEmailUsingAPI = async (
  api_url,
  recipients,
  subject,
  body,
  isHtml
) => {
  var reqBody = "recipients=" + encodeURIComponent(recipients.trim());
  reqBody += "&subject=" + encodeURIComponent(subject);
  reqBody += "&emailBody=" + encodeURIComponent(body);
  reqBody += "&isHtml=" + encodeURIComponent(isHtml);
  reqBody +=
    "&accessTokenSecret=" + encodeURIComponent(constants.ACCESS_TOKEN_SECRET);

  let resObj = await fetch(api_url, {
    headers: {
      Accept: "application/json",
      "Content-type": "application/x-www-form-urlencoded",
    },
    method: "POST",
    body: reqBody,
  });

  if (!resObj?.ok) {
    try {
      let jsonStr = await resObj.json();
      let err = new Error(jsonStr);
      err.jsonified = true;
      throw err;
    } catch (err) {
      if (err.jsonified) throw err;
      else
        throw Error("Network or server fetch error", {
          cause: err,
        });
    }
  }
  let data = await resObj.json();
  return data;
};

const makeEmailNotifyBody = (
  recipients,
  description,
  timezoneDescription,
  startDateTime,
  endDateTime,
  meetingUrl
) => {
  const html = `<html>
  <body>
  <section style="background-color: #edf2fb;box-shadow: 0px 10px 5px grey; border-radius: 10px;border: 1px solid rgb(196, 196, 196);padding: 10px 5px 0px 15px">
  <h2>Hello from <a href="https://scuoler.com/scheduler">Scuoler Event Scheduler</a>,</h2>
  <h2>An event in which you are a participant is starting soon.</h2> 
  <hr>
  <br/>
  <p style="color:#332233;font-size: 17px;font-weight: bolder">Event:<p/> 
  <span style="margin-left:20px; background-color: #1a759f; color: white; font-size: 17px; border-radius:5px; padding: 10px">${description}</span> <br/><br/>
  <span style="color:#332233;font-size: 17px;font-weight: bolder">Participants</span>: <ul style="list-style:none">${recipients
    .split(",")
    .map((val) => {
      return `<li style="color: #1a759f; font-size: 16px;">${val.trim()}</li>`;
    })}</ul> <br/>
  <p style="color:#332233;font-size: 18px;font-weight: bolder">Timezone:</p> <span style="margin-left:18px; font-size: 18px; color: #223322"; background-color:#c7cdd2;>${timezoneDescription}</span> <br/><br/>
  <span style="font-size:18px;font-weight: bolder; width: 100px">From:</span> <span style="color:#3322ff;font-size: 18px; background-color:#c7cdd2; padding: 3px; border-radius: 2px;">${startDateTime}</span> <br/><br/>
  <span style="font-size:18px;font-weight: bolder; width: 100px">To:</span> <span style="color:#3322ff;font-size: 18px; background-color:#c7cdd2; padding: 3px; border-radius: 2px;">${endDateTime}</span> <br/><br/>
  <p style="font-size:20px;font-weight: bolder">Where:</p> <span style="margin-left:20px; font-size: 18px;"><a  href="${meetingUrl}">${meetingUrl}</a><span>
  <br/>
  <hr>
  <h4>Thank You from <a href="https://scuoler.com">Scuoler</a> team<br/></h4>
  <a href="https://scuoler.com">https://scuoler.com</a>
  <br/>
  <h4>Thank you for using the free <a href="https://scuoler.com/scheduler">Scuoler Event Scheduler</a>.</h4>
  <a href="https://scuoler.com/scheduler">https://scuoler.com/scheduler</a>
  <h4>Please help us popularize it by letting your friends know about it.</h4>
  </section>
  </body>
  </html>
 `;
  return html;
};

//const API_URL = `http://localhost:5000/api/sendEmailGeneric`;

const API_URL = `https://scuoler.com/api/sendEmailGeneric`;

const main = () => {
  const pool = new pg.Pool({
    host: configuration.getHost(),
    user: configuration.getUserId(),
    password: configuration.getPassword(),
    database: configuration.getDatabase(),
    port: configuration.getPort(),
    ssl: { rejectUnauthorized: false },
  });

  let sql = `  select id, description, participant_email_ids,
  timezone, timezone_description, start_time,
  end_time, organiser_id, notify_before_minutes
  from public.meetings_to_notify_get();`;

  pool.query(sql, [], function (err, result, fields) {
    if (err) {
      console.log(err);
      pool.end(() => {});
    } else {
      for (let i = 0; i < result.rows.length; i++) {
        let id = result.rows[i].id;
        let meetingUrl = `https://scuoler.com/chat/${id}`;
        let description = result.rows[i].description;
        let participant_email_ids = result.rows[i].participant_email_ids;
        let recipients = participant_email_ids.join(",");
        let timezone = Number(result.rows[i].timezone);
        let timezone_description = result.rows[i].timezone_description;
        let start_time = result.rows[i].start_time;
        let end_time = result.rows[i].end_time;
        let organiser_id = result.rows[i].organiser_id;
        let notify_before_minutes = result.rows[i].notify_before_minutes;
        console.log(
          id,
          description,
          participant_email_ids,
          timezone,
          timezone_description,
          start_time,
          end_time,
          organiser_id,
          notify_before_minutes
        );

        /* The timezone offset needs to be taken to account for  
        date time conversion to selected timezone format  for sending email */
        let dt_startDateTime = utils.dateAddHours(start_time, timezone);
        let dt_endDateTime = utils.dateAddHours(end_time, timezone);

        let str_start_time = dt_startDateTime.toISOString();
        /* Remove ".000z" and replace T with ' ' */
        str_start_time = str_start_time
          .substring(0, str_start_time.length - 5)
          .replace("T", " ");

        let str_end_time = dt_endDateTime.toISOString();
        /* Remove ".000z" and replace T with ' ' */
        str_end_time = str_end_time
          .substring(0, str_end_time.length - 5)
          .replace("T", " ");

        // console.log(
        //   dt_startDateTime.toString(),
        //   dt_endDateTime.toString(),
        //   str_start_time,
        //   str_end_time
        // );
        let htmlBody = makeEmailNotifyBody(
          recipients,
          description,
          timezone_description,
          str_start_time,
          str_end_time,
          meetingUrl
        );
        let emailSubject = `Event Starting Soon:  + ${description.substring(
          0,
          100
        )} ...`;

        sendEmailUsingAPI(API_URL, recipients, emailSubject, htmlBody, true)
          .then((res) => {
            let sql1 = `
            update meeting set notification_sent = true where id=$1;
            `;
            console.log(res);
            pool.query(sql1, [id], function (err, result, fields) {
              pool.end(() => {});
              if (err) {
                console.log(err);
              } else {
                console.log({
                  updatestatus: "ok",
                  meetingId: id,
                  updateDescription: `notification flag updated for meeting ${id}`,
                });
              }
            });
          })
          .catch((err) => {
            console.log(err);
          });
      }
    }
  });
};

//cron.schedule("*/5 * * * *", main);

main();
