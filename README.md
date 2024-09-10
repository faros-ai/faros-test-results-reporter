# Test Results Reporter

CLI for parsing &amp; uploading test results (JUnit, TestNG, xUnit, cucumber etc.) to Faros AI API

# Usage

```sh
$ npm i

$ ./bin/main /path/to/reports.* --format junit \
  --commit GitHub://acme-corp/my-repo/da500aa4f54cbf8f3eb47a1dc2c136715c9197b9 \
  --test-type Unit \
  --test-source CircleCI \
  --test-start "2021-07-20T18:05:46.019Z" \
  --test-end "2021-07-20T18:08:22.113Z" \
  --graph default \
  --api-key $FAROS_API_KEY
```
