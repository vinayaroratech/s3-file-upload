'use strict';

const uuid = require('uuid');
const AWS = require('aws-sdk');
AWS.config.setPromisesDependency(require('bluebird'));
const s3 = new AWS.S3();
let mime = require('mime-types')
const multipart = require('aws-lambda-multipart-parser');
const moment = require('moment');
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const bucketName = "file-protector";
const tableName = "file-protector-prod";

module.exports.submit = async (event, context, callback) => {
  console.log("Request received");
  console.log("isBase64Encoded", event.isBase64Encoded);
  const result = multipart.parse(event, true)
  console.log("result:", result);
  console.log("result.secureCode:", result.secureCode);
  console.log("result.file:", result.file.filename);

  // Extract file content
  // let fileContent = event.isBase64Encoded ? Buffer.from(bodyRequest, 'base64') : JSON.parse(bodyRequest).base64Encoded;
  let fileContent = result.file.content;
  const pin = result.secureCode;
  // Generate file name from current timestamp
  let fileName = `${pin}_${uuid.v1()}`;

  // Determine file extension
  //let contentType = event.headers['content-type'] || event.headers['Content-Type'];
  let contentType = result.file.contentType;
  let extension = contentType ? mime.extension(contentType) : '';
  let fullFileName = extension ? `${fileName}.${extension}` : fileName;

  let response = {
    statusCode: Number,
    body: String
  };

  try {
    submitFileUploadP(fileUploadInfo(result.file.filename, fullFileName, extension, pin))
      .then(res => {
        response = {
          statusCode: 200,
          body: JSON.stringify({
            message: `Sucessfully submitted file with name ${result.file.filename}`,
            fileId: res.id
          })
        };
      })
      .catch(err => {
        console.log(err);
        response = {
          statusCode: 500,
          body: JSON.stringify({
            message: `Unable to submit file with name ${result.file.filename}`,
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
    Bucket: bucketName,
    Key: 'Incoming/' + fullFileName,
    Body: fileContent,
    Metadata: {}
  }).promise();

  console.log("Successfully uploaded file", fullFileName);
}

const submitFileUploadP = file => {
  console.log('Submitting file');
  const fileUploadInfo = {
    TableName: tableName,// process.env.FILE_UPLOAD_TABLE,
    Item: file,
  };
  return dynamoDb.put(fileUploadInfo).promise()
    .then(res => file);
};

const fileUploadInfo = (fileName, generatedFilename, fileExtention, pin) => {
  const timestamp = moment().format('MM/DD/YYYY HH:MM:SS');
  return {
    SecureCode: pin,
    OriginalFileName: fileName,
    GeneratedFileName: generatedFilename,
    ProtectedFileName: '',
    SubmittedAt: timestamp,
    UpdatedAt: timestamp,
  };
};