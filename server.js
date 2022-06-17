//Create node server and listen on port 3000
var express = require('express');
var crypto = require('crypto')
var cors = require('cors')
var mysql = require('mysql');
const session = require('express-session');
const bodyParser = require('body-parser');
const router = express.Router();
const app = express();

app.use(session({secret: 'ssshhhhh',saveUninitialized: true,resave: true}));
app.use(bodyParser.json());      
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(__dirname + '/views'));


var sess,emails,fid;

var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "mydb"
});


//app.use(cors())
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(express.json());


//path to directory where html files are stored
app.use(express.static('views'));



const algorithmAES = 'aes-256-cbc';
const algorithmDES = 'des-ede3-cbc';

let keyAES = crypto.randomBytes(32)
let keyDES = crypto.randomBytes(24)

keyAES = crypto.createHash('sha256').update(String(keyAES)).digest('base64').substr(0,32)
keyDES = crypto.createHash('sha256').update(String(keyDES)).digest('base64').substr(0,24)

// encrypt function - AES
const encryptAES = (buffer) => {
  let iv = crypto.randomBytes(16)
  

  const cipher = crypto.createCipheriv(algorithmAES,keyAES,iv);
  
  const result = Buffer.concat([iv, cipher.update(buffer), cipher.final()])
  console.log(result);
  return result;
}

// encrypt function - DES
const encryptDES = (buffer) => {
  let iv = crypto.randomBytes(8)
  

  const cipher = crypto.createCipheriv(algorithmDES,keyDES,iv);
  const result = Buffer.concat([iv, cipher.update(buffer),cipher.final()])

  return result;
}

//decrypt function - AES
const decryptAES = (encrypted,key) => {
  // get iv : the first 16 bytes
  let iv = encrypted.slice(0,16)
  console.log(iv);
  // get the rest
  encrypted = encrypted.slice(16)
  console.log(encrypted);

  const decipher = crypto.createDecipheriv(algorithmAES,key,iv);

  const result = Buffer.concat([decipher.update(encrypted), decipher.final()])
  
  return result;
}


//decrypt function - DES
const decryptDES = (encrypted,key) => {
  // get iv : the first 16 bytes
  let iv = encrypted.slice(0,8)
  // get the rest
  encrypted = encrypted.slice(8)

  const decipher = crypto.createDecipheriv(algorithmDES,key,iv);

  const result = Buffer.concat([decipher.update(encrypted),decipher.final()])
  return result;
}

router.get('/', function(req, res){
  sess = req.session;
 
  if(sess.userid){
    
    res.sendFile('second.html',{root: 'views'})
  } else{
    
    res.sendFile('first.html',{root: 'views'})
  } 
  
});

// EncryptCall **
router.post('/upload', function(req, res){
  sess = req.session;
  var name = req.body.user.name;
  var base64 = req.body.user.base64
  var beforeBase64 = req.body.user.beforeBase64

  if(sess.userid){
    console.log(sess.userid);
  } else {
    console.log("NULL");
  }
  
 // console.log(name,base64,beforeBase64);

  console.log("Length => "+ base64.length);

  var data1 = base64.slice(0,base64.length/2);
  var data2 = base64.slice(base64.length/2,base64.length);

 // console.log("Len Data1 => "+data1);
 // console.log("Len Data2 => "+data2);
  
  let encryptedAES = encryptAES(data1).toString('hex');
  console.log("encryptedAES => " +encryptedAES.length);

 let encryptedDES = encryptDES(data2).toString('hex');
 console.log("encryptedDES => " +encryptedDES.length);

  
    
    var sql = `INSERT INTO info(name,beforeBase64,en1,en2,keyAES,keyDES,userid) VALUES('${name}','${beforeBase64}','${encryptedAES}','${encryptedDES}','${keyAES}','${keyDES}','${sess.userid}')`;
    con.query(sql, function(err, result){
      if(err) throw err;
      console.log("Inserted");
      let responseJSON = {
        response:"Uploaded", 
      }
      res.send(responseJSON)
  })
 

  
});

// DecryptCall **
router.post('/decrypt', function(req,res){
  var fileId = req.body.user.fid
  var base64Url = '';
  var filename;
  var responseJSON;
  
    var sql = `SELECT * FROM info where id='${fileId}'`;
    con.query(sql, function(err, result){
      if(err) throw err;
      console.log(result);
      let name = result[0].name;
      let beforeBase64 = result[0].beforeBase64;
      let en1 = result[0].en1;
      let en2 = result[0].en2;
      let key1 = result[0].keyAES;
      let key2 = result[0].keyDES;

      console.log(name,beforeBase64,en1 ,en2);

    console.log(en1.length, en2.length);
      let en1Buffer = Buffer.from(en1,'hex')
      console.log(en1Buffer.length);
      let decryptedAES = decryptAES(en1Buffer,key1);
      console.log("decryptedAES => "+decryptedAES); 

      let en2Buffer = Buffer.from(en2,'hex')
      console.log(en2Buffer.length);
      let decryptedDES = decryptDES(en2Buffer,key2);
      console.log("decryptedDES => "+decryptedDES)

      base64Url = beforeBase64 + ',' + decryptedAES + decryptedDES;
      filename = name;
      
      
      responseJSON = {
        link:base64Url,
        name:filename
      }
      responseJSON = JSON.stringify(responseJSON)
      console.log(responseJSON);
      res.send(responseJSON)
      
  })
  
 
  
 
})

// Register ***
router.post('/register', function(req,res){
  var name = req.body.user.name;
  var email = req.body.user.email;
  var password = req.body.user.pass2;
  var number = req.body.user.number;

  console.log(name,number);

 
    var sql = `INSERT INTO users(name,email,password,number) VALUES('${name}','${email}','${password}','${number}')`;
    con.query(sql, function(err, result){
      if(err) throw err;
      let responseJSON = {
        response:"Inserted",
        
      }
      res.send(responseJSON)
      
  })
  
 
})

// Login ***
router.post('/login',function(req,res){
  var email = req.body.user.email;
  var password = req.body.user.password;

  

  var sql = `SELECT * FROM users WHERE email='${email}' AND password='${password}'`;
  con.query(sql, function(err,result){
    if(err) throw err;
    
    if(result.length > 0){
      sess = req.session;
      sess.userid = result[0].id
      
      let responseJSON = {
        response:"Verified", 
      }
      res.send(responseJSON)

    } else {
      responseJSON = {
        response:"Not Verified",
      }
      res.send(responseJSON);
    }
  })
})

// Logout **
router.get('/logout',function(req,res){
  
  req.session.destroy((err) => {
    if(err) {
        return console.log(err);
    } else {
      let responseJSON = {
        response:"LoggedOut", 
      }
      res.send(responseJSON)
    }
    
});
})

//retieve uploaded files
router.get('/retrieve',function(req,res){
    console.log("In Retrieve");
    var sql = `SELECT * FROM info WHERE userid='${sess.userid}' order by id desc`;
    con.query(sql, function(err, result){
      if(err) throw err;
      res.send(JSON.stringify(result));
    })
})



//post the email to share
router.post('/retrieve1',function(req,res){
  console.log("In Retrieve1");

  emails= req.body.user.emails;
  fid=req.body.user.fid;
      let responseJSON = {
        response:"done", 
      }
      res.send(responseJSON)

 
})

//retrieve the details of a person from email
router.get('/retrieve2',function(req,res){
  console.log("In Retrieve2");
  var sql = `SELECT * FROM users WHERE email='${emails}'`;
  con.query(sql, function(err, result){
    if(err) throw err;
    res.send(JSON.stringify(result));
  })
})

//share the files to the required person by giving access 
router.post('/retrieve3',function(req,res){
    console.log("In Retrieve3");

    cid= req.body.user.cid;
    access=1;
    var sql = `INSERT INTO share(aid,cid,fid,access) VALUES('${sess.userid}','${cid}','${fid}','${access}')`;
    con.query(sql, function(err, result){
      if(err) throw err;
      let responseJSON = {
        response:"Given Access",
        
      }
      res.send(responseJSON)
      
  })
})

router.get('/getFilesSharedByMe', function(req,res){
  var sql = `SELECT * FROM share WHERE aid='${sess.userid}' order by id desc`;
  con.query(sql, function(err, result){
    if(err) throw err;
    res.send(JSON.stringify(result));
  })
})

router.post('/getNameAndFileName',function(req,res){
  var nameId = req.body.user.nameid;
  var fileId = req.body.user.fileid;

  var sql=`SELECT * from users WHERE id='${nameId}'`;
  con.query(sql, function(err,result){
    if(result.length > 0){
      var responseJson = [{
        name:result[0].name
      }]
      var sql2=`SELECT * FROM info WHERE id='${fileId}'`;
      con.query(sql2, function(err,result){
        if(result.length > 0){
          responseJson.push({filename:result[0].name})
          console.log(JSON.stringify(responseJson));
          res.send(JSON.stringify(responseJson))
      }
    })
    
    }
  })
})

router.get('/getFilesSharedToMe', function(req,res){
  var sql = `SELECT * FROM share WHERE cid='${sess.userid}' order by id desc`;
  con.query(sql, function(err, result){
    if(err) throw err;
    res.send(JSON.stringify(result));
  })
})

app.use('/', router);
app.listen(3000);