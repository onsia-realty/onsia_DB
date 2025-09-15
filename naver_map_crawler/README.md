# 네이버 지도 크롤러

Playwright를 사용한 네이버 지도 장소 정보 크롤러입니다.

## 주요 기능

- 용인시 처인구/기흥구 음식점, 카페 정보 크롤링
- Anti-detection 브라우저 설정으로 안정적 크롤링
- 윤리적 크롤링 (딜레이, Rate Limiting)
- 엑셀 파일로 결과 저장

## 설치 방법

```bash
# 의존성 설치
pip install -r requirements.txt

# Playwright 브라우저 설치
playwright install chromium
```

## 사용법

```bash
# 기본 크롤링 실행
python crawler.py
```

## 출력 데이터

- 지역, 키워드, 가게명, 주소, 평점, 전화번호, 카테고리, 크롤링 시간

## 주의사항

- robots.txt 준수
- 상업적 이용 전 법적 검토 필요
- 네이버 서비스 약관 준수# onsia_DB
