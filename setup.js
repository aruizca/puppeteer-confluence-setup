const puppeteer = require('puppeteer');
const fs = require('fs');
const rimraf = require('rimraf');

const ADMIN_USER = {
    username: "admin",
    password: "admin",
    fullname: "Mr admin",
    email: "admin@whatever.com"
}

// Configuration settings with defaults
const CONFIG = {
    BASE_URL: process.env.PPTR_CONFLUENCE_BASE_URL || "http://localhost:8090/confluence",
    // If no license is provided, then this 10 user 3 hour timebomb license for any Confluence DC is used
    CONFLUENCE_LICENSE: process.env.PPTR_CONFLUENCE_LICENSE || `AAABtQ0ODAoPeNp9kV9v0zAUxd/9Ka7EWyWnTmESqxSJNQlbxdJUTbLBgAfXuV0NqR3ZTqHfHjdpY
VSCB7/4/jm/e86rR6wh4wdgE2Bsyq6nLITbrIQJC9+SRbdbo8k3lUVjo5CRWCvHhVvwHUZ1y42Rd
vuOu4ZbK7kKhN4RodUm8D1yj5EzHZJlZ8SWW0y4w+i4lrIrykJyLwUqi+WhxX5fnGdZuornN/fnU
vqzlebQzy1f353F04zL5l/qBZo9mnkSzW6vS/qxenhDPzw93dEZCx8HtBeyLyX7mpfiMSqHZkAvu
rUVRrZOajX8jEajRV7S9/mKLld5UsXlPF/Qqkh9IYoNetYa1gdwW4STEqRK6BoNtEZ/Q+Hg89a59
st0PH7WwV/042aYoDhMfA0g0aC0g1paZ+S6c+g3SwtOg+is0zufS0C8IZ5ZcSUuLfNU8Sq9KdOEz
j4dEf8XWuG4+X36Cd47WanvSv9QpEgXkX/0ijGSm2eupOW9MQnusdGtv7BE685nk94NX7/M/TKFy
/BPJjz4047bJyTBPyH0CqcO2GgDvG2hPgNYku550w1YG954il/X0fxXMC0CFQCRUd9kwqDYeFIFJ
yQmlQPeMMYDLQIUYpH3kyyXea6e1PzAN2rpSuuUl4M=X02l1`,
    DB_USER: process.env.PPTR_DB_USER || "postgres",
    DB_PASSWORD: process.env.PPTR_DB_PASSWORD || "postgres",
    DB_JDBC_URL: process.env.PPTR_JDBC_URL || "jdbc:postgresql://postgres:5432/confluence",
    HEADLESS: process.env.PPTR_HEADLESS || false
};

// Async timeout
const delay = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

(async () => {
    const browser = await puppeteer.launch({
        headless: CONFIG.HEADLESS,
        args: [
            '--window-size=1280,900',
            '--no-sandbox'
        ]
    });
    const page = await browser.newPage();
    await page.setViewport({
        width: 1280,
        height: 900,
    });

    const SCREENSHOTS_OUTPUT_PATH = './screenshots'

    try {
        console.log(`Setting up Confluence standalone instance at: ${CONFIG.BASE_URL}`);
        console.log("============================================");
        console.log("with Config:");
        console.log(CONFIG);
        console.log("--------------------------------------------\n");
        console.log("Setup Steps:");
        // Start timing now
        const start = new Date();
        // Setup screenshot directory
        if (fs.existsSync(SCREENSHOTS_OUTPUT_PATH)) {
            // We remove previous screenshots
            rimraf.sync(`${SCREENSHOTS_OUTPUT_PATH}/*.png`);
        }
        
        // Setup wizard - page 1
        await installationTypeSelection(page);

        // Setup wizard - page 2
        await licenseSetup(page);

        // Setup wizard - page 3 (DC only)
        await dcDeploymentTypeSelection(page);

        // Setup wizard - page 4
        await configureDatabase(page);

        // Setup wizard - page 5
        await userConfigurationSetup(page);

        // Admin settings - disable Confluence onboarding module
        await disableConfluenceOnboardingModule(page)

        // Admin settings - set Confluence path to localhost
        if (!CONFIG.BASE_URL.includes('localhost')) {
            await changeConfluencePath(page);
        }

        await page.screenshot({ path: `${SCREENSHOTS_OUTPUT_PATH}/confluence-setup-finished.png` });
        const end = new Date();
        const timeTakenInSeconds = (end - start)/1000
        console.log(`\nConfluence standalone instance setup has finished !! (${timeTakenInSeconds} seconds)`);
        console.log("====================================================");
    } catch (error) {
        console.error(`exception thrown ${error.stack}`)
        await page.screenshot({ path: `${SCREENSHOTS_OUTPUT_PATH}/puppeteer-error.png` });
        await browser.close();
    } finally {
        await browser.close();
    }
})();


async function installationTypeSelection(page) {
    console.log("- Installation type selection");
    let url = `${CONFIG.BASE_URL}/setup/setupstart.action`;

    const maxRetryNumber = 10;
    let success = false;
    for (let retryNumber = 1; retryNumber <= maxRetryNumber; retryNumber++) {
        try {
            const response = await page.goto(url);
            if (response.status() < 400) {
                success = true;
                break;
            }
        } catch (e) {
            await delay(1000 * retryNumber);
        }
    }

    if (!success) {
        throw `Exceeded the allowed time to access the url "${url}"`;
    }

    if (url === await page.evaluate(() => document.location.href)) {
        try {
            await page.click('#custom');
        } catch (e) {
            // For older Confluence versions 6.0 to 6.5
            await page.click('div[setup-type="custom"]');
        }
        await page.click('#setup-next-button');
    }
    await page.waitFor(1500);

    url = `${CONFIG.BASE_URL}/setup/selectbundle.action`;
    if (url === await page.evaluate(() => document.location.href)) {
        await page.click('#setup-next-button');
    }
    await page.waitFor(1500);
}

async function licenseSetup(page) {
    console.log("- License set up");
    let url = `${CONFIG.BASE_URL}/setup/setuplicense.action`;
    if (url === await page.evaluate(() => document.location.href)) {
        await page.click('#confLicenseString');
        await page.evaluate(license => {
            document.getElementById('confLicenseString').value = license;
        }, CONFIG.CONFLUENCE_LICENSE);

        await page.click('#setupTypeCustom');
    }
    await page.waitFor(1500)
}

async function dcDeploymentTypeSelection(page) {
    console.log("- DC deployment type selection");
    const dcClusterURL = `${CONFIG.BASE_URL}/setup/setupcluster-start.action`;
    const dbConfigURL = `${CONFIG.BASE_URL}/setup/setupdbchoice-start.action`;
    if (dcClusterURL === await page.evaluate(() => document.location.href)) {
        await page.click('#clusteringDisabled');
        await page.click('#skip-button');
    } else if(dbConfigURL === await page.evaluate(() => document.location.href)) {
        console.log("- Server license detected -> DC Deployment type selection skipped");
    }
    await page.waitFor(1500);
}

async function configureDatabase(page) {
    console.log("- Configuring Database");
    let url = `${CONFIG.BASE_URL}/setup/setupdbtype-start.action?thisNodeClustered=true`; //ToDo: change for server
    if (url === await page.evaluate(() => document.location.href)) {
        await page.evaluate(() => {
            document.querySelector('#dbConfigInfo-customize').click();
        });

        await page.click('#dbConfigInfo-databaseUrl');
        await page.evaluate(db_url => {
            document.getElementById('dbConfigInfo-databaseUrl').value = db_url;
        }, CONFIG.DB_JDBC_URL);

        await page.click('#dbConfigInfo-username');
        await page.keyboard.type(CONFIG.DB_USER);

        await page.click('#dbConfigInfo-password');
        await page.keyboard.type(CONFIG.DB_PASSWORD);
    }
    
    await Promise.all([
        page.click('#setup-next-button'),
        page.waitForNavigation({ timeout: 0, waitUntil: 'networkidle0' })
    ]);
}

async function userConfigurationSetup(page) {
    console.log("- User Configuration setup");
    let url = `${CONFIG.BASE_URL}/setup/setupdata-start.action`;
    if (url === await page.evaluate(() => document.location.href)) {
        await page.$eval('#blankChoiceForm', form => form.submit());
    }
    await page.waitFor(1000);

    url = `${CONFIG.BASE_URL}/setup/setupusermanagementchoice-start.action`;
    if (url === await page.evaluate(() => document.location.href)) {
        await page.click('#internal');
    }
    await page.waitFor(1000);

    url = `${CONFIG.BASE_URL}/setup/setupadministrator-start.action`;
    if (url === await page.evaluate(() => document.location.href)) {
        await page.click('#fullName');
        await page.keyboard.type(ADMIN_USER.fullname);

        await page.click('#email');
        await page.keyboard.type(ADMIN_USER.email);

        await page.click('#password');
        await page.keyboard.type(ADMIN_USER.password);

        await page.click('#confirm');
        await page.keyboard.type(ADMIN_USER.password);

        await Promise.all([
            page.click('#setup-next-button'),
            page.waitForNavigation({ timeout: 0, waitUntil: 'networkidle0' })
        ]);
        await page.waitFor(1500);
    }
}

async function disableConfluenceOnboardingModule(page) {
    console.log(`- Disable Confluence Onboarding module`);
    // Authenticate as admin
    await page.click('#further-configuration')
    await page.waitFor(5000);
    await page.click('#password');
    await page.keyboard.type(ADMIN_USER.password);
    await Promise.all([
        page.click('#authenticateButton'),
        page.waitForNavigation({ timeout: 0, waitUntil: 'networkidle0' })
    ]);

    // Go to upm for system apps
    let url = `${CONFIG.BASE_URL}/plugins/servlet/upm/manage/system`;
    await page.goto(url);

    // Search for confluence-onboarding app and disable it
    await page.waitFor(10000)
    await page.click('#upm-manage-filter-box');
    await page.evaluate(() => document.getElementById("upm-manage-filter-box").value = "");
    await page.keyboard.type("onboarding");
    await page.waitFor(5000)
    await page.click('div[data-key="com.atlassian.confluence.plugins.confluence-onboarding"]');
    await page.waitFor(5000)
    await page.click('a.aui-button[data-action="DISABLE"]');
}

async function changeConfluencePath(page) {
    const baseUrl = CONFIG.BASE_URL.replace(/(http[s]?:\/\/)(.*)(:.*)/g, '$1localhost$3');
    console.log(`- Setting Confluence base url to: ${baseUrl}`);
    // Go to edit general administration settings
    let url = `${CONFIG.BASE_URL}/admin/editgeneralconfig.action`;
    await page.goto(url);
    // Change Confluence base url
    await page.click('#editbaseurl');
    await page.evaluate(() => document.getElementById("editbaseurl").value = "");
    await page.keyboard.type(baseUrl);
    await page.click('#confirm');
    await page.click('#confirm');
    await page.waitFor(5000);
}