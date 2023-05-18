ot.on('message', (msg) => {
//     const chatId = msg.chat.id;
//     const messageText = msg.text;
//     if (user_details.chatId.expecting === 'username') {
//         user_details.chatId.id = messageText;
//         user_details.chatId.expecting = 'password';
//       bot.sendMessage(chatId, 'Password (Do not worry! It will be confidential):');
//     }
//     else if (user_details.chatId.expecting === 'password') {
//       user_details.chatId.pass = messageText;
//       user_details.chatId.expecting = 'tnow';
//       bot.sendMessage(chatId, `Wait while we are collecting data`);   
       
//         getDetails.test(user_details.chatId.id, user_details.chatId.pass)
//         .then(() => {
//             // user_details=getDetails.user_details;
//             getDetails.user_details.chatId=chatId;
//             // console.log(user_details);
//             const newUser = new User(getDetails.user_details);
//             newUser.save((err) => {
//                 if (err) {
//                   console.log(err);
//                   bot.sendMessage(chatId, 'An error occurred. Please try again later.');
//                 } else {
//                   bot.sendMessage(chatId, 'Your profile has been created! You can /start again. Enjoy!');
//                 }
//             });
        
//         })
//         .catch((error) => {
//             console.error(error);
//             bot.sendMessage(chatId, 'Oops, something went wrong. Please try again later. /start');
//         });
//     }
// });
