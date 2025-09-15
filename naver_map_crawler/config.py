"""
네이버 지도 크롤러 설정 파일
"""
import os
from typing import Dict, List

# 기본 설정
BASE_URL = "https://map.naver.com/p/search"
DELAY_RANGE = (2, 3)  # 요청 간 딜레이 (초)
MAX_RETRIES = 3

# 브라우저 설정
BROWSER_CONFIG = {
    "headless": True,
    "viewport": {"width": 1920, "height": 1080},
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "args": [
        "--no-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-extensions",
        "--no-first-run",
        "--disable-default-apps",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding"
    ]
}

# 크롤링 대상 지역 및 키워드
LOCATIONS = ["용인시 처인구", "용인시 기흥구"]
KEYWORDS = ["음식점", "카페"]

# DOM 셀렉터
SELECTORS = {
    "search_results": ".place_bluelink .moreview",
    "place_name": ".place_bluelink .TYaxT",
    "address": ".place_bluelink .LDgIH",
    "rating": ".place_bluelink .PXMot",
    "phone": ".place_bluelink .dry01",
    "category": ".place_bluelink .KCMnt"
}

# 출력 설정
OUTPUT_DIR = "data"
OUTPUT_FILENAME_FORMAT = "naver_map_data_{date}.xlsx"

# 로깅 설정
LOGGING_CONFIG = {
    "level": "INFO",
    "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    "filename": "crawler.log"
}

# Rate Limiting 설정
RATE_LIMIT = {
    "requests_per_minute": 30,
    "concurrent_requests": 2
}