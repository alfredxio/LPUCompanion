//latest
const TelegramBot = require('node-telegram-bot-api');
const getDetails = require('./getDetails');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const cron = require('node-cron');
const keys = require('./tokens');
//check
const bot = new TelegramBot(keys.telebotkey, { polling: true });
mongoose.set('strictQuery', false);
mongoose.connect(keys.mongouri, { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.log('Error with mongoDB'));

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

const messageSchema = new mongoose.Schema({
    chatId: { type: Number, required: true },
    time: { type: String, required: true },
    msgtosend: { type: String, required: true }
});
  
const messageTimeSchema = new mongoose.Schema({
    sunday: [messageSchema],
    monday: [messageSchema],
    tuesday: [messageSchema],
    wednesday: [messageSchema],
    thursday: [messageSchema],
    friday: [messageSchema],
    saturday: [messageSchema],
});

  
const User = mongoose.model('User', userSchema);
const MessageTime = mongoose.model('MessageTime', messageTimeSchema);


const user_details = {};


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

bot.onText(/\/create/, async (msg) => {
    const chatId = msg.chat.id;
    const newu = {
        id: "",
        pass: "",
        expecting: ""
    };
    user_details[chatId]=newu;
    // console.log(chatId+" "+JSON.stringify(user_details));
    bot.sendMessage(chatId, 'Please enter your LPU UMS login credentials.')
    .then(() => {
        return bot.sendMessage(chatId, 'Username:');
    })
    .catch((error) => {
        console.error(error);
        bot.sendMessage(chatId, 'Oops, something went wrong. Please try again later.');
    });
    user_details[chatId].expecting='username';    

});


bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const messageText = msg.text;
    if(chatId in user_details){
        if (user_details[chatId].expecting === 'username') {
            user_details[chatId].id = messageText;
            user_details[chatId].expecting = 'password';
        bot.sendMessage(chatId, 'Password (Do not worry! It will be confidential):');
        }
        else if (user_details[chatId].expecting === 'password') {
            user_details[chatId].pass = messageText;
            user_details[chatId].expecting = 'tnow';
            bot.sendMessage(chatId, `Wait while we are collecting data`);   
        
            await getDetails.test(user_details[chatId].id, user_details[chatId].pass, chatId)
            .then(() => {
                // console.log("FUN:"+chatId);//
                const userDetails=getDetails.user_details[chatId];
                // console.log("FUN:"+JSON.stringify(userDetails));
                // userDetails.chatId=chatId;
                const newUser = new User(userDetails);
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
        getDetails.test(user.id, user.pass, chatId)
        .then(() => {
            // user_details = getDetails.user_details;
            // user_details.chatId = chatId;
            // console.log(user_details);
            const prevUser=getDetails.user_details[chatId];
            // prevUser.chatId=chatId;

            User.findOneAndUpdate(
            { chatId: chatId }, 
            prevUser,
            { upsert: true, new: true }, 
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



cron.schedule('* * * * *', () => {
    
    const timezone = 'Asia/Kolkata'; 
    const now = moment(); 
    const dayOfWeek = now.tz(timezone).format('dddd').toLowerCase();
    const time = now.tz(timezone).format('HH:mm'); 

    MessageTime.findOne({}).exec((err, data) => {
      if (err) {
        console.error(err);
        return;
      }
      const messages = data[dayOfWeek];
      if (messages && messages.length > 0) {
        const messagesToSend = messages.filter((m) => m.time === time);
        messagesToSend.forEach((messageToSend) => {
        bot.sendMessage(messageToSend.chatId, messageToSend.msgtosend,{parse_mode:'HTML'})
            .then(() => {
                // console.log(`Message sent to chat ${messageToSend.chatId}: ${messageToSend.msgtosend}`);
            })
            .catch((error) => {
                console.error(error);
            });
        });
      }
    });
});



const addMessageTime=async(sch,chatId)=>{
    try{
        for(const day in sch){
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
                    let message = '<b>Class Reminder:</b>\n';
                    message += `[${time}]\n`;
                    message += `\t<code>${subject.Sub_Code}:${subject.Sub_Name}\n`;
                    message += `\t${subject.Room} | ${subject.Roll_No} | ${subject.Att}%\n`;
                    message+='</code>\n';
                    const sendTime = notifyHour+":"+notifyMin;
                    const update = { $push: { [day]: { chatId: chatId, time: sendTime.padStart(5, '0'), msgtosend: message } } };
                    const options = { upsert: true };
                    await MessageTime.updateOne({}, update, options)
                    .then(()=>{})
                    .catch(error => {console.error('Error saving dayMessages document:', error);return false;});
                }
            }
        }
        return true;
    }catch (error) {
        console.error(error);
    }
};


bot.onText(/\/notify/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        const user = await User.findOne({ chatId });
        if (!user) {
            bot.sendMessage(chatId, "No profile found. Please create a profile using the /create command.");
            return;
        }
        if(user.notify==false){
            await addMessageTime(user.schedules,chatId) //adding all times to database
            .then(() => {
                User.updateOne({ chatId }, { notify: true }, function(err, res){});
                bot.sendMessage(chatId, "Great! We will notify you 15 mins before every class..");
            })
            .catch(error => console.error('Error saving dayMessages document:'));
        }
        else{
            bot.sendMessage(chatId, "Notification system already active. /stop and again /notify to update.");
        }
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
        if(user.notify==false){
            bot.sendMessage(chatId, "Notification service already inactive.");
            return;
        }

        const chatIdToDelete = chatId; 
        const query = { 
        $or: [
            { "sunday.chatId": chatIdToDelete },
            { "monday.chatId": chatIdToDelete },
            { "tuesday.chatId": chatIdToDelete },
            { "wednesday.chatId": chatIdToDelete },
            { "thursday.chatId": chatIdToDelete },
            { "friday.chatId": chatIdToDelete },
            { "saturday.chatId": chatIdToDelete },
        ]
        };

        await MessageTime.updateMany(query, {
            $pull: {
                sunday: { chatId: chatIdToDelete },
                monday: { chatId: chatIdToDelete },
                tuesday: { chatId: chatIdToDelete },
                wednesday: { chatId: chatIdToDelete },
                thursday: { chatId: chatIdToDelete },
                friday: { chatId: chatIdToDelete },
                saturday: { chatId: chatIdToDelete },
            }
        });

        await User.updateOne({ chatId }, { notify: false });
        bot.sendMessage(chatId, "Notifications stopped!!");
        
    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, "An error occurred while fetching the user's profile.");
    }
});



process.on("unhandledRejection", (error) => {
    console.error("Unhandled Promise Rejection:", error);
  });
  