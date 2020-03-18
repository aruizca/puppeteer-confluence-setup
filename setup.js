const puppeteer = require('puppeteer');

const ADMIN_USER = {
    username: "admin",
    password: "admin",
    fullname: "Mr admin",
    email: "admin@whatever.com"
}

// START: Configuration settings with defaults
const BASE_URL = process.env.BASE_URL || "http://localhost:8090/confluence";
// This license is a 3 hours timebomb license for any Atlassian Server product
const CONFLUENCE_LICENSE = process.env.CONFLUENCE_LICENSE || `AAACLg0ODAoPeNqNVEtv4jAQvudXRNpbpUSEx6FIOQBxW3ZZiCB0V1WllXEG8DbYke3A8u/XdUgVQ
yg9ZvLN+HuM/e1BUHdGlNvuuEHQ73X73Y4bR4nbbgU9ZwFiD2IchcPH+8T7vXzuej9eXp68YSv45
UwoASYhOeYwxTsIE7RIxtNHhwh+SP3a33D0XnntuxHsIeM5CIdwtvYxUXQPoRIF6KaC0FUGVlEB3
v0hOAOWYiH9abFbgZith3i34nwOO65gsAGmZBhUbNC/nIpjhBWEcefJWelzqIDPWz/OtjmXRYv2X
yqwnwueFkT57x8e4cLmbCD1QnX0UoKQoRc4EUgiaK4oZ2ECUrlZeay75sLNs2JDmZtWR8oPCfWZG
wHAtjzXgIo0SqmZiKYJmsfz8QI5aI+zApuq6fqJKVPAMCPnNpk4LPW6kBWgkZb+kQAzzzS2g6Dnt
e69Tqvsr4SOskIqEFOeggz1v4zrHbr0yLJR8rU64FpQpVtBy1mZxM4CnHC9Faf8tKMnTF1AiXORF
ixyQaWto3RZ+ncWLXtMg6EnKZZRpmQNb2R8tnJXFulCfXmXLry7TrHBWn2HNVyH8WYxj9AzmsxiN
L/R88Xg6rA1lVs4QpO5titxhplJcCY2mFFZLutAZVhKipm15/VhJx36YVqyN8YP7IaGC1+lwnJ7Q
5pJpNmxk5hP3qovutY8Pi4E2WIJ59esnr1p+T6eD67teBVCHf+ga+ho4/4D9YItZDAsAhQ5qQ6pA
SJ+SA7YG9zthbLxRoBBEwIURQr5Zy1B8PonepyLz3UhL7kMVEs=X02q6`;
const DB_USER = process.env.DB_USER || "postgres";
const DB_PASSWORD = process.env.DB_PASSWORD || "postgres";
const DB_HOSTNAME = process.env.DB_HOSTNAME || "postgres";
const DB_NAME = process.env.DB_NAME || "confluence";
const JDBC_URL = `jdbc:postgresql://${DB_HOSTNAME}:5432/${DB_NAME}`;
const HEADLESS = process.env.HEADLESS || false;
// END: Configuration settings with defaults

(async () => {
    const browser = await puppeteer.launch({
        headless: HEADLESS,
        args: [
            '--window-size=1280,900',
        ]
    });
    const page = await browser.newPage();
    await page.setViewport({
        width: 1280,
        height: 900,
    });

    try {
        console.log(`Setting up Confluence standalone instance at: ${BASE_URL}`);
        console.log("============================================");

        // Setup - page 1
        await installationTypeSelection(page);

        // Setup - page 2
        await licenseSetup(page);

        // Setup - page 3
        await configureDatabase(page);

        // Setup - page 4
        await userConfigurationSetup(page);

        // Setup - disable Confluence onboarding module
        await disableConfluenceOnboardingModule(page)
    } catch (error) {
        console.error(`exception thrown ${error}`)
        await page.screenshot({ path: 'screenshots/puppeteer-error.png' });
        await browser.close();
    } finally {
        await browser.close();
    }

    console.log("Confluence standalone instance has been setup!!");
    console.log("=========================================+=====");
})();


async function installationTypeSelection(page) {
    console.log(`installation type selection`);
    let url = `${BASE_URL}/setup/setupstart.action`;
    await page.goto(url);
    if (url == await page.evaluate(() => document.location.href)) {
        await page.click('#custom');
        await page.click('#setup-next-button');
    }
    await page.waitFor(1500);

    url = `${BASE_URL}/setup/selectbundle.action`;
    if (url == await page.evaluate(() => document.location.href)) {
        await page.click('#setup-next-button');
    }
    await page.waitFor(1500);
}

async function licenseSetup(page) {
    console.log(`license set up`);
    let url = `${BASE_URL}/setup/setuplicense.action`;
    if (url == await page.evaluate(() => document.location.href)) {
        await page.click('#confLicenseString');
        await page.evaluate(license => {
            document.getElementById('confLicenseString').value = license;
        }, CONFLUENCE_LICENSE);

        await page.click('#setupTypeCustom');
    }
    await page.waitFor(1500)
}

async function configureDatabase(page) {
    console.log(`configuring database`);
    let url = `${BASE_URL}/setup/setupdbchoice-start.action`;
    if (url == await page.evaluate(() => document.location.href)) {
        await page.click('#custom');
        await page.click('#setup-next-button');
    }
    await page.waitFor(1000);

    await page.click('#dbConfigInfo-customize');
    await page.evaluate(db_url => {
        document.getElementById('dbConfigInfo-databaseUrl').value = db_url;
    }, JDBC_URL);

    await page.click('#dbConfigInfo-username');
    await page.keyboard.type(DB_USER);

    await page.click('#dbConfigInfo-password');
    await page.keyboard.type(DB_PASSWORD);

    await Promise.all([
        page.click('#setup-next-button'),
        page.waitForNavigation({ timeout: 0, waitUntil: 'networkidle0' })
    ]);
}

async function userConfigurationSetup(page) {
    console.log(`userConfiguration setup`);
    let url = `${BASE_URL}/setup/setupdata-start.action`;
    if (url == await page.evaluate(() => document.location.href)) {
        await page.$eval('#blankChoiceForm', form => form.submit());
    }
    await page.waitFor(1000);

    url = `${BASE_URL}/setup/setupusermanagementchoice-start.action`;
    if (url == await page.evaluate(() => document.location.href)) {
        await page.click('#internal');
    }
    await page.waitFor(1000);

    url = `${BASE_URL}/setup/setupadministrator-start.action`;
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
}

async function disableConfluenceOnboardingModule(page) {
    console.log(`Disable Confluence Onboarding module`);

    page.click('#further-configuration')
    await page.waitFor(5000);
    await page.click('#password');
    await page.keyboard.type(ADMIN_USER.password);
    await Promise.all([
        page.click('#authenticateButton'),
        page.waitForNavigation({ timeout: 0, waitUntil: 'networkidle0' })
    ]);

    let url = `${BASE_URL}/plugins/servlet/upm/manage/system`;
    await page.goto(url);

    await page.waitFor(10000)
    await page.click('#upm-manage-filter-box');
    await page.evaluate( () => document.getElementById("upm-manage-filter-box").value = "");
    await page.keyboard.type("confluence-onboarding");
    await page.waitFor(5000)
    await page.click('div[data-key="com.atlassian.confluence.plugins.confluence-onboarding"]');
    await page.waitFor(5000)
    await page.click('a.aui-button[data-action="DISABLE"]');

    await page.screenshot({ path: 'screenshots/confluence-setup-finished.png' });
}