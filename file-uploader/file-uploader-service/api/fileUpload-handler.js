'use strict';

const uuid = require('uuid');
const AWS = require('aws-sdk');
AWS.config.setPromisesDependency(require('bluebird'));
const s3 = new AWS.S3();
let mime = require('mime-types')

const dynamoDb = new AWS.DynamoDB.DocumentClient();

module.exports.submit = async (event, context, callback) => {
  console.log("Request received");

  // Extract file content
  let fileContent = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;

  // Generate file name from current timestamp
  let fileName = `${Date.now()}`;
  try {
    // Determine file extension
    let contentType = event.headers['content-type'] || event.headers['Content-Type'];

    let extension = contentType ? mime.extension(contentType) : '';

    let fullFileName = extension ? `${fileName}.${extension}` : fileName;

    const pin = 1234;

    let response = {
      statusCode: Number,
      body: String
    };

    submitFileUploadP(fileUploadInfo(fileName, extension, pin))
      .then(res => {
        response = {
          statusCode: 200,
          body: JSON.stringify({
            message: `Sucessfully submitted file with name ${fileName}`,
            fileId: res.id
          })
        };
      })
      .catch(err => {
        console.log(err);
        response = {
          statusCode: 500,
          body: JSON.stringify({
            message: `Unable to submit file with name ${fileName}`,
            Error: err
          })
        };
      });

    await uploadFileToS3(fullFileName, fileContent);

    callback(null, response);

  } catch (err) {
    console.log("Failed to upload file", fullFileName, err);
    callback(new Error('Couldn\'t upload file.'));
  };

};


const uploadFileToS3 = async (fullFileName, fileContent) => {
  console.log("Submitting the file to S3", fullFileName);

  let data = await s3.putObject({
    Bucket: "file-protection-bucket",
    Key: fullFileName,
    Body: fileContent,
    Metadata: {}
  }).promise();

  console.log("Successfully uploaded file", fullFileName);
}

const submitFileUploadP = file => {
  console.log('Submitting file');
  const fileUploadInfo = {
    TableName: process.env.FILE_UPLOAD_TABLE,
    Item: file,
  };
  return dynamoDb.put(fileUploadInfo).promise()
    .then(res => file);
};

const fileUploadInfo = (fileName, fileExtention, pin) => {
  const timestamp = new Date().getTime();
  return {
    id: uuid.v1(),
    fileName: fileName,
    fileExtention: fileExtention,
    pin: pin,
    submittedAt: timestamp,
    updatedAt: timestamp,
  };
};