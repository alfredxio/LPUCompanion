const puppeteer = require('puppeteer');
const moment = require('moment-timezone');

var monday = {"08-09": "","09-10": "","10-11": "","11-12": "","12-01": "","01-02": "","02-03": "","03-04": "","04-05": "","05-06": "","06-07": "",};
var tuesday = {"08-09": "","09-10": "","10-11": "","11-12": "","12-01": "","01-02": "","02-03": "","03-04": "","04-05": "","05-06": "","06-07": "",};
var wednesday = {"08-09": "","09-10": "","10-11": "","11-12": "","12-01": "","01-02": "","02-03": "","03-04": "","04-05": "","05-06": "","06-07": "",};
var thursday = {"08-09": "","09-10": "","10-11": "","11-12": "","12-01": "","01-02": "","02-03": "","03-04": "","04-05": "","05-06": "","06-07": "",};
var friday = {"08-09": "","09-10": "","10-11": "","11-12": "","12-01": "","01-02": "","02-03": "","03-04": "","04-05": "","05-06": "","06-07": "",};
var saturday = {"08-09": "","09-10": "","10-11": "","11-12": "","12-01": "","01-02": "","02-03": "","03-04": "","04-05": "","05-06": "","06-07": "",};
var sunday = {"08-09": "","09-10": "","10-11": "","11-12": "","12-01": "","01-02": "","02-03": "","03-04": "","04-05": "","05-06": "","06-07": "",};

var schedules = {
    monday: monday,
    tuesday: tuesday,
    wednesday: wednesday,
    thursday: thursday,
    friday: friday,
    saturday: saturday,
    sunday: sunday,
};

var sc2={};

const user_details = {
    id:'',
    pass: '',
    cgpa : '',
    p_name : '',
    regno : '',
    section: '',
    progname : '',
    AttPercent : '',
    pendingAss:{},
    subjects: {},
    schedules: sc2,
    notify:false,
    lastSynced:''
};



let test= async(id, pass)=> {
    var browser='';
    try { 
        user_details.id=id;
        user_details.pass=pass;
        browser = await puppeteer.launch({
            headless: false,
            args: ["--no-sandbox", '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();

        await page.setRequestInterception(true);
        page.on("request", (req) => {
        if (
            req.resourceType() == "stylesheet" ||
            req.resourceType() == "font" ||
            req.resourceType() == "image"
        ) {
            req.abort();
        } else {
            req.continue();
        }
        });

        // const page = await browser.newPage();
        await page.goto('https://ums.lpu.in/lpuums/');
        await page.waitForSelector('#TxtpwdAutoId_8767', { visible: true });
        await page.type('#txtU', id);
        await page.type('#TxtpwdAutoId_8767', pass);
        await page.waitForSelector('#TxtpwdAutoId_8767', { visible: true });
        await page.type('#TxtpwdAutoId_8767', pass);

        await Promise.all([
        page.click('#iBtnLogins'),
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        ]);

        // get user basic details
        user_details.cgpa = await page.$eval('#cgpa', (el) => el.textContent.trim());
        user_details.p_name = await page.$eval('#p_name', (el) => el.textContent.trim());

        var temp_res = await page.$eval('#regno', (el) => el.textContent.trim());
        const regex = /Reg. No.: (\d+) \| Section: (\w+)/;
        const matches = temp_res.match(regex);
        if(matches){
            user_details.regno=matches[1];
            user_details.section=matches[2];
        }
        else regno=temp_res;

        user_details.progname = await page.$eval('#progname', (el) => el.textContent.trim());

        var tempat = await page.$eval('#AttPercent', (el) => el.textContent.trim());
        user_details.AttPercent=tempat.match(/\d+/)[0];

        //get Assignments

        const penasss = await page.$$eval('#PendingAssignments .row', rows => {
            let k=[];
            rows.forEach((row) => {
                const subjectCode = row.querySelector('.right-arrow').textContent.trim();
                const peninfo = row.querySelector('.font-weight-medium').textContent.trim();
                k.push({subjectCode,peninfo});
            });
            return k;
        });
        
        penasss.forEach((item) => {
                user_details.pendingAss[item.subjectCode] = item.peninfo;
        });
        

        //get subjects
        await page.goto('https://ums.lpu.in/lpuums/default3.aspx');
        await page.waitForSelector('#view1', { visible: true });
        
        const sub = await page.$$eval("#view1 .skillbar", (skillbars) => {
            let s = [];
            skillbars.forEach((skillbar) => {
                const roll = skillbar
                    .querySelector(".skillbar-title span:first-child")
                    .textContent.trim();
                const subjectCode = skillbar
                    .querySelector(".skillbar-title span:last-child")
                    .textContent.trim()
                    .match(/(\w+)/)[1];
                const subjectName = skillbar
                    .querySelector(".skillbar-bar span:first-child")
                    .textContent.trim();
                const subatt = skillbar
                    .querySelector(".skill-bar-percent span:first-child")
                    .textContent.trim();  
                s.push({subjectCode, roll, subjectName, subatt });
            });
            return s;
        });
        
        sub.forEach((item) => {
                user_details.subjects[item.subjectCode] = {
                roll: item.roll,
                subjectName: item.subjectName,
                subatt: item.subatt
            };
        });

        // console.log(user_details.subjects);


        // get time table.
        await page.goto('https://ums.lpu.in/LpuUms/Reports/frmStudentTimeTable.aspx');

        await page.waitForSelector('td[class*="100cl"]', { visible: true });
            
        const rowsTime = await page.$$('td[class*="100cl"]');

        const rowsMonday = await page.$$('td[class*="104cl"]');
        const rowsTuesday = await page.$$('td[class*="108cl"]');
        const rowsWednesday = await page.$$('td[class*="112cl"]');
        const rowsThursday = await page.$$('td[class*="116cl"]');
        const rowsFriday = await page.$$('td[class*="120cl"]');
        const rowsSaturday = await page.$$('td[class*="124cl"]');
        const rowsSunday = await page.$$('td[class*="128cl"]');

        var i = 0;
        for (const r of rowsTime) {
            var timing = (
                await (await r.getProperty("textContent")).jsonValue()
            )
                .split(" ")[0]
                .trim();
            var mon = await (
                await rowsMonday[i].getProperty("textContent")
            ).jsonValue();
            var tues = await (
                await rowsTuesday[i].getProperty("textContent")
            ).jsonValue();
            var wed = await (
                await rowsWednesday[i].getProperty("textContent")
            ).jsonValue();
            var thurs = await (
                await rowsThursday[i].getProperty("textContent")
            ).jsonValue();
            var fri = await (
                await rowsFriday[i].getProperty("textContent")
            ).jsonValue();
            var sat = await (
                await rowsSaturday[i].getProperty("textContent")
            ).jsonValue();
            var sun = await (
                await rowsSunday[i].getProperty("textContent")
            ).jsonValue();

            monday[timing] = mon;
            tuesday[timing] = tues;
            wednesday[timing] = wed;
            thursday[timing] = thurs;
            friday[timing] = fri;
            saturday[timing] = sat;
            sunday[timing] = sun;

            i++;
        }
        
        // detailed time table c-days
        for(const x in schedules){
            const data1=schedules[x];
            sc2[x]={};
            for (const timeSlot in data1) {
                const activity = data1[timeSlot].replace(/\s/g, "");
                if(/\d/.test(activity))sc2[x][timeSlot]=[];
                else continue;
                const matches = activity.match(/G:\w*C:([^\/]+)\/R:([^\/]+)/g);
                if (matches) {
                    const pairs = matches.map(match => {
                        const values = match.match(/C:([^\/]+)\/R:([^\/]+)/);
                        return { cValue: values[1], rValue: values[2] };
                    });
                    for (let i = 0; i < pairs.length; i++) {
                
                            sc2[x][timeSlot].push({
                                'Sub_Code': pairs[i].cValue,
                                'Sub_Name': user_details.subjects[pairs[i].cValue].subjectName,
                                'Room': pairs[i].rValue,
                                'Roll_No': user_details.subjects[pairs[i].cValue].roll,
                                'Att': user_details.subjects[pairs[i].cValue].subatt
                                });
                    
                    }

                }
            }
            // console.log(sc2[x]);
        }
        


        //log everything
        // console.log("oh yeah!!",user_details);
        user_details.lastSynced=moment().tz('Asia/Kolkata').format('DD-MM-YYYY HH:mm:ss');
        await browser.close();
    }
    catch (error) {
        if(browser)await browser.close();
        console.log(error);
        throw error;
        
    }
}

module.exports = {
    user_details,
    test,
  };

  