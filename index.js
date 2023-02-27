const TelegramBot = require('node-telegram-bot-api');
const getDetails = require('./getDetails');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const schedule = require('node-schedule');
const keys = require('./tokens');
//check
const bot = new TelegramBot(keys.telebotkey, { polling: true });
mongoose.set('strictQuery', false);
mongoose.connect(keys.mongouri, { useNewUrlParser: true, useUnifiedTopology: true });

const userSchema = new mongoose.Schema({
    chatId: {type: Number,required: true,unique: true},
    id: {type: String,required: true,unique: true},
    pass: {type: String},
    cgpa: {type: String},
    p_name: {type: String},
    regno: {type: String},
    section: {type: String},
    progname: {type: String},
    AttPercent: {type: String},
    pendingAss: {type: Object,default: {}},
    subjects: {type: Object,default: {}},
    schedules: {type: Object,default: {}},
    notify: {type: Boolean,default: false},
    lastSynced:{type:String}
});
  
const User = mongoose.model('User', userSchema);

var user_details = {
    chatId:'',
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
    schedules: {},
    notify: false,
    lastSynced:''
};

const replyKeyboard = {
    keyboard: [
        ['/timetable', '/assignments'],
        ['/update','/delete']
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  };


bot.onText(/\/start/,async (msg) => {
    check=true;
    const chatId = msg.chat.id;
    const chatName=msg.chat.username;
    console.log(chatId+" "+chatName);
    User.findOne({ chatId: chatId }, (err, user) => {
        if (err) {
          console.log(err);
          bot.sendMessage(chatId, 'An error occurred. Please try again later.');
        }
        else if (user) {
            bot.sendMessage(chatId, `Welcome back, ${user.p_name}!`, {
                reply_markup: JSON.stringify(replyKeyboard)});
        }
        else {
          bot.sendMessage(chatId, 'Welcome to LPUCompanion! To get started, please create a profile using the /create command.');
        }
    });
});


let expecting = '';

bot.onText(/\/create/, async (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Please enter your LPU UMS login credentials.')
    .then(() => {
        return bot.sendMessage(chatId, 'Username:');
    })
    .catch((error) => {
        console.error(error);
        bot.sendMessage(chatId, 'Oops, something went wrong. Please try again later.');
    });
    expecting='username';    
});


bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const messageText = msg.text;
    if (expecting === 'username') {
      user_details.id = messageText;
      expecting = 'password';
      bot.sendMessage(chatId, 'Password (Do not worry! It will be confidential):');
    }
    else if (expecting === 'password') {
      user_details.pass = messageText;
      expecting = 'tnow';
      bot.sendMessage(chatId, `Wait while we are collecting data`);   
       
        getDetails.test(user_details.id, user_details.pass)
        .then(() => {
            user_details=getDetails.user_details;
            user_details.chatId=chatId;
            // console.log(user_details);
            const newUser = new User(user_details);
            newUser.save((err) => {
                if (err) {
                  console.log(err);
                  bot.sendMessage(chatId, 'An error occurred. Please try again later.');
                } else {
                  bot.sendMessage(chatId, 'Your profile has been created! You can /start again. Enjoy!');
                }
            });
        
        })
        .catch((error) => {
            console.error(error);
            bot.sendMessage(chatId, 'Oops, something went wrong. Please try again later. /start');
        });
    }
});


bot.onText(/\/timetable/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        const user = await User.findOne({ chatId });
        if (!user) {
            bot.sendMessage(chatId, "No profile found. Please create a profile using the /create command.");
            return;
        }

        const day = moment.tz('Asia/Kolkata').format('dddd').toLowerCase();
        const data1=user.schedules[day];
        
        let message = '<strong>Today\'s TimeTable:</strong><code>\n\n';
        for (const timeSlot in data1) {
            message += `</code>[${timeSlot}]<code> \n`;
            data1[timeSlot].forEach((entry) => {
                message += `\t${entry.Sub_Code}:${entry.Sub_Name}\n`;
                message += `\t${entry.Room} | ${entry.Roll_No} | ${entry.Att}%\n`;
            });
            message+='\n';
        }
        message+=`\n</code>Last Synced:${user.lastSynced}`;
        bot.sendMessage(chatId, `${message}`,{parse_mode:'HTML'});
        

    } catch (error) {
      console.error(error);
      bot.sendMessage(chatId, "An error occurred while fetching the user's profile.");
    }
  });

  bot.onText(/\/assignments/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        const user = await User.findOne({ chatId });
        if (!user) {
            bot.sendMessage(chatId, "No profile found. Please create a profile using the /create command.");
            return;
        }

        const data1=user.pendingAss;
        
        let message = '<strong>Pending Assignments:</strong><code>\n\n';
        for (const ass in data1) {
            // console.log(ass);
            const lines = data1[ass].split('|');
            message += `${lines[0]}[${user.subjects[ass].subjectName}]\n`;
            message += `${lines[1]} ${lines[2]}`;
            message +='\n \n';
        }
        message+=`</code>Last Synced:${user.lastSynced}\nWe suggest you /update.`;
        bot.sendMessage(chatId, `${message}`,{parse_mode:'HTML'});
        

    } catch (error) {
      console.error(error);
      bot.sendMessage(chatId, "An error occurred while fetching the user's profile.");
    }
  });


  bot.onText(/\/update/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        const user = await User.findOne({ chatId });
        if (!user) {
            bot.sendMessage(chatId, "No profile found. Please create a profile using the /create command.");
            return;
        }
        getDetails.test(user.id, user.pass)
        .then(() => {
            user_details = getDetails.user_details;
            user_details.chatId = chatId;
            // console.log(user_details);
            
            User.findOneAndUpdate(
            { chatId: chatId }, // search for the document with the given chatId
            user_details, // update the document with the new user_details object
            { upsert: true, new: true }, // upsert: create a new document if it doesn't exist, new: return the modified document instead of the original
            (err, doc) => {
                if (err) {
                console.log(err);
                bot.sendMessage(chatId, 'An error occurred. Please try again later.');
                } else {
                bot.sendMessage(chatId, 'Your profile has been updated! You can /start again. Enjoy!');
                }
            }
            );
        })
        .catch((error) => {
            console.error(error);
            bot.sendMessage(chatId, 'Oops, something went wrong. Please try again later. /start');
        });
        
    } catch (error) {
      console.error(error);
      bot.sendMessage(chatId, "An error occurred while fetching the user's profile.");
    }
  });

  bot.onText(/\/delete/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        const user = await User.findOne({ chatId });
        if (!user) {
            bot.sendMessage(chatId, "No profile found. Please create a profile using the /create command.");
            return;
        }
        User.findOneAndDelete({ chatId })
        .then((deletedUser) => {
            if (deletedUser) {
                bot.sendMessage(chatId, `Profile deleted successfully.`);
            // Do something else if needed
            } else {
                bot.sendMessage(chatId, `No user not found.`);
            }
        })
        .catch((err) => {
            console.error(err);
        });
    } catch (error) {
      console.error(error);
      bot.sendMessage(chatId, "An error occurred while fetching the user's profile.");
    }
});

function sendNotification(sch,chatId) {
    console.log("Running");
    const day = moment.tz('Asia/Kolkata').format('dddd').toLowerCase();
    const today = moment().tz('Asia/Kolkata');
    const month = today.format('M');
    const year = today.format('YYYY');
    const date = today.format('D');

    const t_table=sch[day];

    for (const time in t_table) {
        const subjects=t_table[time];
        var [startHour, startMin] = time.split('-')[0].split(':').map(Number);
        if(!startMin)startMin=0;
        var notifyHour = startHour;
        var notifyMin = startMin - 15;
        if(notifyMin<0){
            notifyHour--;
            if(notifyHour>=0 && notifyHour<=6)notifyHour+=12;
            notifyMin=45;
        }

        for (const subject of subjects) {
            let message = 'Class Reminder:\n';
            message += time + '\n';
            message += `\t${subject.Sub_Code}:${subject.Sub_Name}\n`;
            message += `\t${subject.Room} | ${subject.Roll_No} | ${subject.Att}%\n`;
            message+='\n';
            message=`<code>${message}</code>`;
            // console.log(year, month, date, notifyHour, notifyMin, 0);
            const istDate = new Date(year, month, date, notifyHour, notifyMin, 0);
            const utcTime = istDate.getTime() + (istDate.getTimezoneOffset() * 60000) + (5.5 * 60 * 60000);
            const unixTime = Math.floor(utcTime / 1000);
            
            console.log(unixTime,utcTime);

            bot.sendMessage(chatId, message, {
                parse_mode: 'HTML',
                disable_notification: false,
                schedule_date: unixTime
            });
        }
    }

  }

bot.onText(/\/notify/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        const user = await User.findOne({ chatId });
        if (!user) {
            bot.sendMessage(chatId, "No profile found. Please create a profile using the /create command.");
            return;
        }
        User.updateOne({ chatId }, { notify: true }, function(err, res){});
        
        schedule.scheduleJob('*/10 * * * * *', () => {
            sendNotification(user.schedules,chatId);
        });
        bot.sendMessage(chatId, "Great! We will notify you 15 mins before every class..");
        
    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, "An error occurred while fetching the user's profile.");
    }
});

bot.onText(/\/stop/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        const user = await User.findOne({ chatId });
        if (!user) {
            bot.sendMessage(chatId, "No profile found. Please create a profile using the /create command.");
            return;
        }
        User.updateOne({ chatId }, { notify: false }, function(err, res){});

        bot.sendMessage(chatId, "Notifications stopped!!");
        
    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, "An error occurred while fetching the user's profile.");
    }
});