# Onsia DB

부동산 데이터베이스 및 크롤링 프로젝트

## 📁 프로젝트 구조

```
onsia_DB/
├── SuperClaude/           # SuperClaude 프레임워크
├── naver_map_crawler/     # 네이버 지도 크롤러
├── README.md             # 이 파일
└── .gitignore           # Git 제외 파일 목록
```

## 🗺️ 네이버 지도 크롤러

Playwright와 Undetected Chrome을 사용한 네이버 지도 장소 정보 크롤러

### 주요 기능
- 용인시 처인구/기흥구 음식점, 카페 정보 크롤링
- 봇 감지 우회 기능
- Excel 파일 저장

### 사용법
```bash
cd naver_map_crawler
pip install -r requirements_selenium.txt
python crawler_selenium.py
```

## 🚀 SuperClaude

Claude Code 강화 프레임워크

## 📄 라이선스

MIT License

## ⚠️ 주의사항

- 네이버 서비스 약관 준수
- robots.txt 확인 필수
- 상업적 사용 전 법적 검토 필요