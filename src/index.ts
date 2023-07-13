import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import cors from 'cors';
import axios from 'axios';
import { S3Client } from '@aws-sdk/client-s3';
import {
  PresignedPostOptions,
  createPresignedPost,
} from '@aws-sdk/s3-presigned-post';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT;

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.use(bodyParser.json());
app.use(cors());
app.options('*', cors());

app.post(
  '/getpresignedurl',
  async (req: Request, res: Response): Promise<void> => {
    // const { userId, key, filename } = req.params;
    const key = 'testObjectKey/filename';
    const { url, fields } = await getS3PresignedUrl(key);

    // send form data and url to client side
    // res.status(200).json({ url, fields })

    // Alternatively, upload to s3 from server using axios (should be the same as frontend)
    await uploadFile(path.join(__dirname, 'example.pdf'), url, fields);

    res.status(200).json({ url });
  }
);

const getS3PresignedUrl = (key: string) => {
  const s3 = new S3Client({ region: 'us-east-2' });
  // Other s3 credential are set in .env and automatically read by SDK
  const params: PresignedPostOptions = {
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    Expires: 300, // in seconds
    Key: key,
    Fields: {
      acl: 'private', // matches s3 default access permission (block all access)
      'Content-Type': '*', // 'application/pdf',
      success_action_status: '201',
    },
    Conditions: [
      { acl: 'private' },
      { success_action_status: '201' },
      // { 'Content-Type': 'application/pdf' },
      ['eq', '$key', key],
      ['content-length-range', 1048576, 1048576 * 50], // size limit: 1 - 50 MB
      { 'x-amz-algorithm': 'AWS4-HMAC-SHA256' },
    ],
  };
  return createPresignedPost(s3, params);
};

// Example axios call to upload file to s3 directly
const uploadFile = (
  path: string,
  url: string,
  fields: Record<string, string>
): Promise<void> => {
  const file = fs.readFileSync(path);
  if (!file) Promise.reject();
  return axios
    .postForm(
      url,
      { ...fields, file },
      {
        onUploadProgress: (e) => {
          const percentage = Math.round((e.loaded / e.total!) * 100);
          console.log(percentage + '%');
        },
      }
    )
    .then((res) => {
      console.log('post successful', res.data);
    })
    .catch((err) => {
      console.error(err);
    });
};

app.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}`);
});
