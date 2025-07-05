const https = require("https");

const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const zoneId = process.env.CLOUDFLARE_ZONE_ID;
const domain = process.env.DOMAIN;

async function main() {
  log("Fire");

  if (!apiToken) throw "Set CLOUDFLARE_API_TOKEN";
  if (!zoneId) throw "Set CLOUDFLARE_ZONE_ID";
  if (!domain) throw "Set DOMAIN";

  const nextAddr = (await getHttps("https://checkip.amazonaws.com")).trim();

  const currentRecords = (
    await requestCloudflare(`zones/${zoneId}/dns_records`, "get")
  ).result;

  const targetRecord = currentRecords.find(
    (r) => r.name === domain && r.type === "A"
  );

  if (!targetRecord) {
    throw "No record.";
  }

  const currentAddr = targetRecord.content;

  if (currentAddr === nextAddr) return;

  log(`Current: ${currentAddr}`);
  log(`Next: ${nextAddr}`);

  const recordBody = {
    type: "A",
    name: domain,
    content: nextAddr,
    ttl: 1, // Automatic
    proxied: false,
  };

  await requestCloudflare(
    `zones/${zoneId}/dns_records/${targetRecord.id}`,
    "put",
    recordBody
  );

  log("Update done");
}

async function requestCloudflare(url, method, body = null) {
  return new Promise((resolve, reject) => {
    let responseString = "";

    const req = https.request(
      "https://api.cloudflare.com/client/v4/" + url,
      {
        method: method,
        headers: {
          "Content-type": "application/json",
          Authorization: "Bearer " + apiToken,
        },
      },
      (res) => {
        res.on("data", (d) => {
          responseString += d.toString();
        });

        res.on("close", () => {
          const res = JSON.parse(responseString);
          if (res.errors.length !== 0) {
            reject(res.errors);
          } else {
            resolve(res);
          }
        });
      }
    );

    req.on("error", (err) => {
      reject(err);
    });

    req.end(body ? JSON.stringify(body) : null);
  });
}

async function getHttps(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        res.on("data", (data) => {
          if (typeof data === "string") {
            resolve(string);
          } else {
            resolve(data.toString());
          }
        });
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}

function launch() {
  main().catch((e) => {
    log("ERROR CAUSED");
    log(e);
  });
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

process.on("SIGINT", () => {
  log("Interrupted");
  process.exit(0);
});

launch();
setInterval(() => {
  launch();
}, 5 * 60 * 1000);
