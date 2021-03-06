/* ===== SHA256 with Crypto-js ===============================
|  Learn more: Crypto-js: https://github.com/brix/crypto-js  |
|  =========================================================*/

const SHA256 = require('crypto-js/sha256');
const express = require('express');
const bodyParser = require('body-parser');

const level = require('./levelSandbox.js');
const block = require('./block.js').Block;
const request = require('./localModules.js').Request;
const response = require('./localModules.js').Response;

/* ===== Blockchain Class ==========================
|  Class with a constructor for new blockchain  		|
|  ================================================*/

class Blockchain {
  constructor() {
    level.countBlocks().then(value => {
      if (value === 0) {
        this.addBlock(new block("First block in the chain - Genesis block"));
      }
    });
  }

  //#region begin request functions
  requestValidation(address) {
    let sampleRequest = new request(address);
    let sampleResponse = new response(address, sampleRequest.time);
    var parsedResponse = JSON.stringify(sampleResponse);
    return parsedResponse;
  }
  //#endregion end request functions
  //#region begin blockchain functions
  getBlock(blockHeight) {
    return new Promise(function (resolve, reject) {
      level.getBlock(blockHeight)
        .then(function (value) {
          resolve(value);
        })
        .catch(function (error) {
          reject(error);
        })
    })
  }

  getBlockHeight() {
    return new Promise(function (resolve, reject) {
      level.getBlockHeight()
        .then(function (value) {
          resolve(value);
        })
        .catch(function (error) {
          reject(error);
        })
    })
  }

  // Add new block
  addBlock(newBlock) {
    return new Promise(function (resolve, reject) {
      // Block height
      if (newBlock.body != "First block in the chain - Genesis block") {
        console.log("-------------------");
        console.log("Adding new block");
        console.log("Data: " + newBlock.body);
        newBlock.time = new Date().getTime().toString().slice(0, -3);
        console.log("Time: " + newBlock.time);
        level.countBlocks()
          .then(function (height) {
            newBlock.height = height;
            console.log("Height: " + newBlock.height);
          })
          .then(function () {
            level.getBlock(newBlock.height - 1)
              .then(function (value) {
                value = JSON.parse(value);
                newBlock.previousBlockHash = value.hash;
                console.log("New block's previous hash is: " + newBlock.previousBlockHash);
              })
              .then(function () {
                newBlock.hash = SHA256(JSON.stringify(newBlock)).toString();
                console.log("Hash: " + newBlock.hash);
              })
              .then(function () {
                console.log("about to add the new block to the chain");
                level.addLevelDBData(newBlock.height, JSON.stringify(newBlock).toString())
                  .then(value => {
                    console.log("Block data: " + value);
                    resolve(value);
                    console.log("-------------------");
                  });
              })
              .catch(function (error) {
                console.log(error);
                reject(error);
              })
            // Adding block object to chain
          })
          .catch(function (error) {
            console.log(error);
            reject(error);
          });
      } else {
        console.log("-------------------");
        console.log("Adding genesis block");
        console.log("Height: " + newBlock.height);
        console.log("Data: " + newBlock.body);
        console.log("Time: " + newBlock.time);
        console.log("Previous block hash:" + newBlock.previousBlockHash);
        newBlock.hash = SHA256(JSON.stringify(newBlock)).toString();
        console.log("Hash: " + newBlock.hash);
        level.addLevelDBData(newBlock.height, JSON.stringify(newBlock).toString()).then(value => {
          resolve(value);
        });
        console.log("-------------------");
      }

    })
  }

  // validate block
  validateBlock(blockHeight) {
    return new Promise(function (resolve, reject) {
      // get block object
      level.getBlock(blockHeight)
        .then(value => {
          let block = JSON.parse(value);
          // get block hash
          let blockHash = block.hash;
          // remove block hash to test block integrity
          block.hash = '';
          // generate block hash
          let validBlockHash = SHA256(JSON.stringify(block)).toString();
          // Compare
          if (blockHash === validBlockHash) {
            resolve(true);
            console.log("true");
          } else {
            resolve(false);
            console.log("true");
          }
        })
        .catch(function (error) {
          reject(error);
        })
    })
  }

  // Validate blockchain
  validateChain() {
    let errorLog = [];
    level.countBlocks()
      .then(value => {
        for (var i = 0; i < value; i++) {
          // validate block
          this.validateBlock(i)
            .then(function (booleanValue) {
              if (booleanValue === false) errorLog.push(i);
              else {
                console.log("Validated block.");
              }
            })
          // compare blocks hash link
          level.getBlock(i)
            .then(function (block) {
              let parsedBlockOne = JSON.parse(block);
              let hash = parsedBlockOne.hash;
              let nextBlockHeight = parsedBlockOne.height + 1;
              if (nextBlockHeight == value) {
                console.log("reached it's limit!");
                return;
              }
              console.log("hash of block : " + hash);
              level.getBlock(nextBlockHeight)
                .then(function (block) {
                  let parsedBlockTwo = JSON.parse(block);
                  let previousBlockHash = parsedBlockTwo.previousBlockHash;
                  console.log("previous hash of block: " + previousBlockHash);
                  if (hash !== previousBlockHash) {
                    errorLog.push(i);
                  } else {
                    console.log("Block hash is same as next block's previous hash!");
                  }
                })
            })
        }
        if (errorLog.length > 0) {
          console.log('Block errors = ' + errorLog.length);
          console.log('Blocks: ' + errorLog);
          return false;
        } else {
          console.log('No errors detected');
          return true;
        }
      })
  }
  //#endregion end blockchain functions

}

//#region begin blockchain API functions
blockchain = new Blockchain();
const app = express()
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({
  extended: true
})); // for parsing application/x-www-form-urlencoded

app.get('/block/:blockNumber', (req, res) => blockchain.getBlock(req.params['blockNumber'])
  .then(value => {
    let text = JSON.parse(value);
    res.send(text);
  })
  .catch(function (error) {
    console.log("No block found!" + error);
    res.json("No block found! " + error);
  }))

app.post('/block/:blockData', (req, res) => {
  blockchain.addBlock(new block(req.params['blockData']))
    .then(value => {
      let addedBlock = JSON.parse(value);
      res.send(addedBlock);
    })
    .catch(function (error) {
      res.json("Couldn't add block!");
    })
})

app.post('/block/', (req, res) => {
  if (req.body.body === "" || req.body.body === undefined) {
    res.send("Could not add block!");
  } else {
    blockchain.addBlock(new block(req.body.body))
      .then(value => {
        let block = JSON.parse(value);
        res.send(block);
      })
      .catch(function (error) {
        res.json("Couldn't add block!");
      })
  }
})

app.post('/requestValidation/', (req, res) => {
  if (req.body.address === "" || req.body.address === undefined) {
    res.send("No address provided!");
  } else {
    res.send(JSON.parse(blockchain.requestValidation(req.body.address)));
  }
})

//#endregion begin blockchain API functions
app.listen(8000, () => console.log('Example app listening on port 8000!'))