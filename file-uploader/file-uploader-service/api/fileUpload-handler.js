'use strict';

const uuid = require('uuid');
const AWS = require('aws-sdk');
AWS.config.setPromisesDependency(require('bluebird'));

const dynamoDb = new AWS.DynamoDB.DocumentClient();

module.exports.submit = (event, context, callback) => {
  const requestBody = JSON.parse(event.body);
  const fullname = requestBody.fullname;
  const email = requestBody.email;
  const experience = requestBody.experience;

  if (typeof fullname !== 'string' || typeof email !== 'string' || typeof experience !== 'number') {
    console.error('Validation Failed');
    callback(new Error('Couldn\'t upload file because of validation errors.'));
    return;
  }


  submitFileUploadP(fileUploadInfo(fullname, email, experience))
    .then(res => {
      callback(null, {
        statusCode: 200,
        body: JSON.stringify({
          message: `Sucessfully submitted file with email ${email}`,
          fileId: res.id
        })
      });
    })
    .catch(err => {
      console.log(err);
      callback(null, {
        statusCode: 500,
        body: JSON.stringify({
          message: `Unable to submit file with email ${email}`,
          Error: err
        })
      })
    });
};


const submitFileUploadP = file => {
  console.log('Submitting file');
  const fileUploadInfo = {
    TableName: process.env.FILE_UPLOAD_TABLE,
    Item: file,
  };
  return dynamoDb.put(fileUploadInfo).promise()
    .then(res => file);
};

const fileUploadInfo = (fullname, email, experience) => {
  const timestamp = new Date().getTime();
  return {
    id: uuid.v1(),
    fullname: fullname,
    email: email,
    experience: experience,
    submittedAt: timestamp,
    updatedAt: timestamp,
  };
};