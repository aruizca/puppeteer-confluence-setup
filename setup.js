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
    // If no license is provided, then this 10 user 3 hour timebomb license for Confluence DC is used
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
    HEADLESS: process.env.PPTR_HEADLESS || false,
    LDAP_CONFIG: process.env.PPTR_LDAP_CONFIG || true
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

        // Admin settings - set Confluence path to 'localhost' (if not 'localhost' already)
        if (!CONFIG.BASE_URL.includes('localhost')) {
            await changeConfluencePath(page);
        }

        // Admin settings - User Directory configuration (optional)
        if(CONFIG.LDAP_CONFIG === true) {
            await setUpUserDirectoryConfig(page);
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

    // Select DC deployment type if a DC license was introduced
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

    const server_db_choose_url = `${CONFIG.BASE_URL}/setup/setupdbchoice-start.action`;
    const dc_db_setup_url = `${CONFIG.BASE_URL}/setup/setupdbtype-start.action?thisNodeClustered=true`;
    const server_db_setup_url = `${CONFIG.BASE_URL}/setup/setupdbtype-start.action`;

    // Select db to custom if a server license was introduced
    if (server_db_choose_url === await page.evaluate(() => document.location.href)) {
        await page.click('#custom');
        await page.click('#setup-next-button');

        await page.waitFor(1000);
    }

    if (dc_db_setup_url === await page.evaluate(() => document.location.href)
        || server_db_setup_url === await page.evaluate(() => document.location.href) ) {
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
    await page.waitFor(10000);
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

async function setUpUserDirectoryConfig(page) {
    console.log("- Linking OpenLDAP User Directory (https://github.com/aruizca/docker-test-openldap)");

    // Go to LDAP User Directory addition form
    let url = `${CONFIG.BASE_URL}/plugins/servlet/embedded-crowd/configure/ldap`;
    await page.goto(url);
    await page.waitFor(1000);

    // Server Settings - Server Name: Futurama HR
    await page.click('#configure-ldap-form-name');
    await page.evaluate(name => {
        document.getElementById('configure-ldap-form-name').value = name;
    }, "Futurama HR");
    await page.waitFor(1000);

    // Server Settings - Directory Type: OpenLDAP
    await page.select('#configure-ldap-form-type', 'com.atlassian.crowd.directory.OpenLDAP')

    //  Server Settings - Hostname: ldap
    await page.click('#configure-ldap-form-hostname');
    await page.evaluate(hostName => {
        document.getElementById('configure-ldap-form-hostname').value = hostName;
    }, "ldap");

    //  Server Settings - Port: 389
    await page.click('#configure-ldap-form-port');
    await page.evaluate(port => {
        document.getElementById('configure-ldap-form-port').value = port;
    }, "389");

    // Server Settings - Use SSL: false
    const useSSL = await page.$("#configure-ldap-form-useSSL");
    const isUseSslChecked = await (await useSSL.getProperty("checked")).jsonValue();
    if(isUseSslChecked) {
        useSSL.click();
    }

    //  Server Settings - Username: cn=admin,dc=planetexpress,dc=com
    await page.click('#configure-ldap-form-ldapUserdn');
    await page.evaluate(userName => {
        document.getElementById('configure-ldap-form-ldapUserdn').value = userName;
    }, "cn=admin,dc=planetexpress,dc=com");

    //  Server Settings - Password: password
    await page.click('#configure-ldap-form-ldapPassword');
    await page.evaluate(password => {
        document.getElementById('configure-ldap-form-ldapPassword').value = password;
    }, "password");

    // LDAP Schema - Base DN: dc=planetexpress,dc=com
    await page.click('#configure-ldap-form-ldapBasedn');
    await page.evaluate(baseDN => {
        document.getElementById('configure-ldap-form-ldapBasedn').value = baseDN;
    }, "dc=planetexpress,dc=com");

    // LDAP Schema - Additional User DN: ''
    await page.click('#configure-ldap-form-ldapUserDn');
    await page.evaluate(ldapUserDn => {
        document.getElementById('configure-ldap-form-ldapUserDn').value = ldapUserDn;
    }, "");

    // LDAP Schema - Additional Group DN: ''
    await page.click('#configure-ldap-form-ldapGroupDn');
    await page.evaluate(ldapGroupDn => {
        document.getElementById('configure-ldap-form-ldapGroupDn').value = ldapGroupDn;
    }, "");

    // LDAP Permissions - Permissions: Read Only, with Local Groups
    const ldapPermissionsRadio = await page.$('#configure-ldap-form-ldapPermissionOption-READ_ONLY_LOCAL_GROUPS');
    await ldapPermissionsRadio.evaluate(r => r.click());
    // await page.click('#configure-ldap-form-ldapPermissionOption-READ_ONLY_LOCAL_GROUPS');
    await page.waitFor(1000);

    // LDAP Permissions - Default Group Memberships: confluence-users
    await page.click('#configure-ldap-form-ldapAutoAddGroups');
    await page.evaluate(defaultGroup => {
        document.getElementById('configure-ldap-form-ldapAutoAddGroups').value = defaultGroup;
    }, "confluence-users");

    // User Schema - display
    await page.click('#toggle-user-scheme-settings > div > span');

    // User Schema - User Object Class: inetorgperson
    await page.click('#configure-ldap-form-ldapUserObjectclass');
    await page.evaluate(userObjClass => {
        document.getElementById('configure-ldap-form-ldapUserObjectclass').value = userObjClass;
    }, "inetorgperson");

    // User Schema - User Object Filter: (objectclass=inetorgperson)
    await page.click('#configure-ldap-form-ldapUserFilter');
    await page.evaluate(userObjFilter => {
        document.getElementById('configure-ldap-form-ldapUserFilter').value = userObjFilter;
    }, "(objectclass=inetorgperson)");

    // User Schema - User Name Attribute: uid
    await page.click('#configure-ldap-form-ldapUserUsername');
    await page.evaluate(userNameAttribute => {
        document.getElementById('configure-ldap-form-ldapUserUsername').value = userNameAttribute;
    }, "uid");

    // User Schema - User Name RDN Attribute: cn
    await page.click('#configure-ldap-form-ldapUserUsernameRdn');
    await page.evaluate(userRDNAttribute => {
        document.getElementById('configure-ldap-form-ldapUserUsernameRdn').value = userRDNAttribute;
    }, "cn");

    // User Schema - User First Name Attribute: givenName
    await page.click('#configure-ldap-form-ldapUserFirstname');
    await page.evaluate(userFirstName => {
        document.getElementById('configure-ldap-form-ldapUserFirstname').value = userFirstName;
    }, "givenName");

    // User Schema - User Last Name Attribute: sn
    await page.click('#configure-ldap-form-ldapUserLastname');
    await page.evaluate(userLastNameAttribute => {
        document.getElementById('configure-ldap-form-ldapUserLastname').value = userLastNameAttribute;
    }, "sn");

    // User Schema - User Display Name Attribute: displayName
    await page.click('#configure-ldap-form-ldapUserDisplayname');
    await page.evaluate(userDisplayNameAttribute => {
        document.getElementById('configure-ldap-form-ldapUserDisplayname').value = userDisplayNameAttribute;
    }, "displayName");

    // User Schema - Generic User Email Attribute: mail
    await page.click('#configure-ldap-form-ldapUserEmail');
    await page.evaluate(userMailAttribute => {
        document.getElementById('configure-ldap-form-ldapUserEmail').value = userMailAttribute;
    }, "mail");

    // User Schema - User Password Attribute: userPassword
    await page.click('#configure-ldap-form-ldapUserPassword');
    await page.evaluate(userPassword => {
        document.getElementById('configure-ldap-form-ldapUserPassword').value = userPassword;
    }, "userPassword");

    // User Schema - User Password Encryption: sha
    await page.select('#configure-ldap-form-ldapUserEncryption', 'sha');

    // User Schema - User Unique ID Attribute: entryUUID
    await page.click('#configure-ldap-form-ldapExternalId');
    await page.evaluate(uniqueIdAttribute => {
        document.getElementById('configure-ldap-form-ldapExternalId').value = uniqueIdAttribute;
    }, "entryUUID");

    // Group Schema - display
    await page.click('#toggle-group-schema-settings > div > span');

    // Group Schema - Group Object Class: Group
    await page.click('#configure-ldap-form-ldapGroupObjectclass');
    await page.evaluate(groupObjClass => {
        document.getElementById('configure-ldap-form-ldapGroupObjectclass').value = groupObjClass;
    }, "Group");

    // Group Schema - Group Object Filter: (objectClass=Group)
    await page.click('#configure-ldap-form-ldapGroupFilter');
    await page.evaluate(groupObjFilter => {
        document.getElementById('configure-ldap-form-ldapGroupFilter').value = groupObjFilter;
    }, "(objectClass=Group)");

    // Group Schema - Group Name Attribute: cn
    await page.click('#configure-ldap-form-ldapGroupName');
    await page.evaluate(groupNameAttribute => {
        document.getElementById('configure-ldap-form-ldapGroupName').value = groupNameAttribute;
    }, "cn");

    // Group Schema - Group Description Attribute: description
    await page.click('#configure-ldap-form-ldapGroupDescription');
    await page.evaluate(groupDescrAttribute => {
        document.getElementById('configure-ldap-form-ldapGroupDescription').value = groupDescrAttribute;
    }, "description");

    // Membership Schema - display
    await page.click('#toggle-membership-schema-settings > div > span');

    // Membership Schema - Group Members Attribute: member
    await page.click('#configure-ldap-form-ldapGroupUsernames');
    await page.evaluate(groupMembersAttribute => {
        document.getElementById('configure-ldap-form-ldapGroupUsernames').value = groupMembersAttribute;
    }, "member");

    // Membership Schema - User Membership Attribute: memberOf
    await page.click('#configure-ldap-form-ldapUserGroup');
    await page.evaluate(userMembershipAttribute => {
        document.getElementById('configure-ldap-form-ldapUserGroup').value = userMembershipAttribute;
    }, "memberOf");

    // Membership Schema - Use the User Membership Attribute: false
    const ldapUserMembershipUse = await page.$("#configure-ldap-form-ldapUsermembershipUse");
    const isLdapUserMembershipUseChecked = await (await ldapUserMembershipUse.getProperty("checked")).jsonValue();
    if(isLdapUserMembershipUseChecked) {
        ldapUserMembershipUse.click();
    }

    // Configuration - Save configuration
    await page.click('#configure-ldap-form-submit');
    await page.waitFor(1000);
}