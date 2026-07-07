# AICC Android WebView

Next.js로 배포된 AICC 운영관리 포털을 Android WebView 앱으로 감싸는 최소 래퍼입니다.

## 설정

1. `app/build.gradle`의 `BuildConfig.AICC_URL` 값을 운영 또는 프리뷰 URL로 변경합니다.

```gradle
buildConfigField "String", "AICC_URL", "\"https://aicc-management-console.vercel.app/\""
```

2. Android Studio에서 `aicc-android-webview` 폴더를 엽니다.
3. Gradle Sync 후 `Build > Generate Signed Bundle / APK`로 APK 또는 AAB를 생성합니다.

## 포함 기능

- WebView 기반 Next.js 앱 로드
- CookieManager 세션 유지
- Android 뒤로가기 처리
- 외부 도메인 링크는 브라우저로 열기
- 파일 업로드 처리
- 다운로드 매니저 연동
- WebView 전용 User-Agent: `AICC-Android-WebView`

## 운영 전 체크

- 운영 URL은 HTTPS를 사용해야 합니다.
- 파일 첨부/다운로드 화면을 실제 기기에서 확인해 주세요.
- 푸시 알림이 필요하면 FCM 토큰 등록 API와 Android native bridge를 추가하면 됩니다.
