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
    // If no license is provided, then this 3 hours timebomb license for any Atlassian Server product is used
    CONFLUENCE_LICENSE: process.env.PPTR_CONFLUENCE_LICENSE || `AAACLg0ODAoPeNqNVEtv4jAQvudXRNpbpUSEx6FIOQBxW3ZZiCB0V1WllXEG8DbYke3A8u/XdUgVQ
yg9ZvLN+HuM/e1BUHdGlNvuuEHQ73X73Y4bR4nbbgU9ZwFiD2IchcPH+8T7vXzuej9eXp68YSv45
UwoASYhOeYwxTsIE7RIxtNHhwh+SP3a33D0XnntuxHsIeM5CIdwtvYxUXQPoRIF6KaC0FUGVlEB3
v0hOAOWYiH9abFbgZith3i34nwOO65gsAGmZBhUbNC/nIpjhBWEcefJWelzqIDPWz/OtjmXRYv2X
yqwnwueFkT57x8e4cLmbCD1QnX0UoKQoRc4EUgiaK4oZ2ECUrlZeay75sLNs2JDmZtWR8oPCfWZG
wHAtjzXgIo0SqmZiKYJmsfz8QI5aI+zApuq6fqJKVPAMCPnNpk4LPW6kBWgkZb+kQAzzzS2g6Dnt
e69Tqvsr4SOskIqEFOeggz1v4zrHbr0yLJR8rU64FpQpVtBy1mZxM4CnHC9Faf8tKMnTF1AiXORF
ixyQaWto3RZ+ncWLXtMg6EnKZZRpmQNb2R8tnJXFulCfXmXLry7TrHBWn2HNVyH8WYxj9AzmsxiN
L/R88Xg6rA1lVs4QpO5titxhplJcCY2mFFZLutAZVhKipm15/VhJx36YVqyN8YP7IaGC1+lwnJ7Q
5pJpNmxk5hP3qovutY8Pi4E2WIJ59esnr1p+T6eD67teBVCHf+ga+ho4/4D9YItZDAsAhQ5qQ6pA
SJ+SA7YG9zthbLxRoBBEwIURQr5Zy1B8PonepyLz3UhL7kMVEs=X02q6`,
    DB_USER: process.env.PPTR_DB_USER || "postgres",
    DB_PASSWORD: process.env.PPTR_DB_PASSWORD || "postgres",
    DB_JDBC_URL: process.env.PPTR_JDBC_URL || "jdbc:postgresql://postgres:5432/confluence",
    HEADLESS: process.env.PPTR_HEADLESS || false
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
        const start = performance.now();
        // Setup screenshot directory
        if (fs.existsSync(SCREENSHOTS_OUTPUT_PATH)) {
            // We remove previous screenshots
            rimraf.sync(`${SCREENSHOTS_OUTPUT_PATH}/*.png`);
        }
        
        // Setup wizard - page 1
        await installationTypeSelection(page);

        // Setup wizard - page 2
        await licenseSetup(page);

        // Setup wizard - page 3
        await configureDatabase(page);

        // Setup wizard - page 4
        await userConfigurationSetup(page);

        // Admin settings - disable Confluence onboarding module
        await disableConfluenceOnboardingModule(page)

        // Admin settings - set Confluence path to localhost
        if (!CONFIG.BASE_URL.includes('localhost')) {
            await changeConfluencePath(page);
        }

        await page.screenshot({ path: `${SCREENSHOTS_OUTPUT_PATH}/confluence-setup-finished.png` });
        const end = performance.now();
        const timeTakenInSeconds = (end - start)/1000
        console.log
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
    await page.goto(url);
    if (url == await page.evaluate(() => document.location.href)) {
        await page.click('#custom');
        await page.click('#setup-next-button');
    }
    await page.waitFor(1500);

    url = `${CONFIG.BASE_URL}/setup/selectbundle.action`;
    if (url == await page.evaluate(() => document.location.href)) {
        await page.click('#setup-next-button');
    }
    await page.waitFor(1500);
};

async function licenseSetup(page) {
    console.log("- License set up");
    let url = `${CONFIG.BASE_URL}/setup/setuplicense.action`;
    if (url == await page.evaluate(() => document.location.href)) {
        await page.click('#confLicenseString');
        await page.evaluate(license => {
            document.getElementById('confLicenseString').value = license;
        }, CONFIG.CONFLUENCE_LICENSE);

        await page.click('#setupTypeCustom');
    }
    await page.waitFor(1500)
};

async function configureDatabase(page) {
    console.log("- Configuring Database");
    let url = `${CONFIG.BASE_URL}/setup/setupdbchoice-start.action`;
    if (url == await page.evaluate(() => document.location.href)) {
        await page.click('#custom');
        await page.click('#setup-next-button');
    }
    await page.waitFor(1000);

    await page.click('#dbConfigInfo-customize');
    await page.evaluate(db_url => {
        document.getElementById('dbConfigInfo-databaseUrl').value = db_url;
    }, CONFIG.DB_JDBC_URL);

    await page.click('#dbConfigInfo-username');
    await page.keyboard.type(CONFIG.DB_USER);

    await page.click('#dbConfigInfo-password');
    await page.keyboard.type(CONFIG.DB_PASSWORD);

    await Promise.all([
        page.click('#setup-next-button'),
        page.waitForNavigation({ timeout: 0, waitUntil: 'networkidle0' })
    ]);
};

async function userConfigurationSetup(page) {
    console.log("- User Configuration setup");
    let url = `${CONFIG.BASE_URL}/setup/setupdata-start.action`;
    if (url == await page.evaluate(() => document.location.href)) {
        await page.$eval('#blankChoiceForm', form => form.submit());
    }
    await page.waitFor(1000);

    url = `${CONFIG.BASE_URL}/setup/setupusermanagementchoice-start.action`;
    if (url == await page.evaluate(() => document.location.href)) {
        await page.click('#internal');
    }
    await page.waitFor(1000);

    url = `${CONFIG.BASE_URL}/setup/setupadministrator-start.action`;
    if (url == await page.evaluate(() => document.location.href)) {
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
};

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
    await page.keyboard.type("confluence-onboarding");
    await page.waitFor(5000)
    await page.click('div[data-key="com.atlassian.confluence.plugins.confluence-onboarding"]');
    await page.waitFor(5000)
    await page.click('a.aui-button[data-action="DISABLE"]');
};

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
};