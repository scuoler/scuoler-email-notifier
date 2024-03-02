const pg = require("pg");
const cron = require("node-cron");

const configuration = require("../Configuration");
const utils = require("../utils/Utils");
const constants = require("../Constants");

//const API_URL = `http://localhost:5000/api/sendEmailGeneric`;

const API_URL = `https://scuoler.com/api/sendEmailGeneric`;

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

const sendMeetingNotifications = () => {
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
      let meetingIdsNotified = [];
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
            console.log(res);
            meetingIdsNotified.push(id);
          })
          .catch((err) => {
            console.log(err);
          });
      }
      let sql1 = `
            update meeting set notification_sent = true where id=ANY($1);
            `;
      pool.query(sql1, [meetingIdsNotified], function (err, result, fields) {
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
    }
  });
};

const makeMarketingEmailBody = (name) => {
  const html = `<html>
  <body>
  <section style="background-color: #edf2fb;box-shadow: 0px 10px 5px grey; border-radius: 10px;border: 1px solid rgb(196, 196, 196);padding: 10px 5px 0px 15px">
  <h2>Dear ${name}, </h2>
  <h2>Thanks for visiting <a href="https://scuoler.com/">Scuoler</a>,</h2>
  <h3>We hope you have great time learning/educating/building with us.</h3> 
  <h3>Kindly remember to take the following steps, as soon as possible.</h2> 
  <hr>
  <br/>
  <ol>
  <li>
  <p style="color:#332233;font-size: 17px;font-weight: bolder">
  Be an Instructor/Mentor<p/>
  <img style="object-fit: contain; width: 300px; height:300px" 
  src="https://res.cloudinary.com/dqsndcxbu/image/upload/v1708763447/employee/ffsamztkyo5wiwsibq47.jpg"/>
  <span style="margin-left:8px; font-size: 18px; color: #223322; font-weight: normal">
  After signing in, from the home page, click on the profile icon. 
  Click the checkbox labelled 'Are you interested in being an Instructor/Mentor'. 
  Provide your educational qualifications, industrial experiences, and competencies 
  around which you want to instruct/mentor. We will match you to students/mentees. 
  Hurray, you can start making revenue. 
  </span> <br/>
  </li>
  <li>
  <p style="color:#332233;font-size: 17px;font-weight: bolder">
  Be a Course Creator<p/>
  <span style="margin-left:8px; font-size: 18px; color: #223322; font-weight: normal">
  If you have deep knowledge about a topic. Why not create a course on Scuoler platform on that topic.
  We can help you publish and popularize your content on Google, Bing, and other search engines, 
  on social networks such as Facebook and LinkedIn. This will help people in discovering your content faster
  and establish yourself as an instructional designer. You can turn on the Ads option 
  and make revenue based on number of views. If this interests you, then click on
  <a href="https://scuoler.com/courseInsert">https://scuoler.com/courseInsert</a>
  <span><br/>
  </li>
  </ol>
  <br/>
  <hr>
  <h4>Thank You from <a href="https://scuoler.com">Scuoler</a> team<br/></h4>
  <a href="https://scuoler.com">https://scuoler.com</a>
  </section>
  </body>
  </html>
 `;
  return html;
};

const sendMarketingEmails = () => {
  const pool = new pg.Pool({
    host: configuration.getHost(),
    user: configuration.getUserId(),
    password: configuration.getPassword(),
    database: configuration.getDatabase(),
    port: configuration.getPort(),
    ssl: { rejectUnauthorized: false },
  });
  let sql = `  
  select distinct first_name, email from public.customer
  where email like '%@%'
  and marketing_email_send = true 
  and coalesce(marketing_email_sent_timestamp, '1970-01-01')< now() - interval '1 month' 
  ;`;

  pool.query(sql, [], function (err, result, fields) {
    if (err) {
      console.log(err);
      pool.end(() => {});
    } else {
      const sent_emails = [];
      for (let i = 0; i < result.rows.length; i++) {
        let name = result.rows[i].first_name;
        let email = result.rows[i].email;
        console.log(name, email);
        let htmlBody = makeMarketingEmailBody(name);
        sent_emails.push(email);

        sendEmailUsingAPI(API_URL, email, "Hello From Scuoler", htmlBody, true)
          .then((res) => {
            sent_emails.push(email);
          })
          .catch((err) => {
            console.log(err);
          });
      }
      let sql1 = `update public.customer 
      set marketing_email_sent_timestamp=now()
      where email=ANY($1 )
      `;
      pool.query(sql1, [sent_emails], function (err, result, field) {
        if (err) {
          pool.end(() => {});
          console.log(err);
        }
      });
    }
  });
};

//cron.schedule("*/5 * * * *", main);
const main = () => {
  sendMeetingNotifications();
  sendMarketingEmails();
};
main();
