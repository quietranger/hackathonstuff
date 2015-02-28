package com.symphony.firehose;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.zip.GZIPInputStream;


public class HelloWorld {
    public static void main(String[] args) throws IOException {
        URL url = new URL("https://dev6-firehose.symphony.com/firehose/stream");
        String charset = StandardCharsets.UTF_8.toString();
        HttpURLConnection firehose = null;

        try {
            firehose = (HttpURLConnection) url.openConnection();
            firehose.setReadTimeout(60000);
            firehose.setConnectTimeout(60000);
            firehose.setDoInput(true);
            firehose.setDoOutput(true);
            firehose.setRequestProperty("Accept-Encoding", "gzip");
            firehose.setRequestMethod("GET");
            firehose.setRequestProperty("Content-Type", "application/json");


            try {
                InputStream inputStream = firehose.getInputStream();
                System.out.println("Streaming");
                try {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(new StreamingGZIPInputStream(inputStream), charset));
                    String message;
                    while ((message = reader.readLine()) != null) {
                        if (!message.isEmpty()) {
                            System.out.println(message);
                        }
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        } finally {
            firehose.disconnect();
        }
    }

    private static class StreamingGZIPInputStream extends GZIPInputStream {

        private final InputStream wrapped;

        public StreamingGZIPInputStream(InputStream is) throws IOException {
            super(is);
            wrapped = is;
        }

        @Override
        public int available() throws IOException {
            return wrapped.available();
        }
    }
}