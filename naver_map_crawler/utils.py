"""
네이버 지도 크롤러 유틸리티 함수들
"""
import re
import os
import logging
import asyncio
import random
from datetime import datetime
from typing import Optional, Dict, Any
import pandas as pd

def setup_logging(config: Dict[str, Any]) -> logging.Logger:
    """로깅 설정"""
    logging.basicConfig(
        level=getattr(logging, config["level"]),
        format=config["format"],
        filename=config["filename"]
    )
    return logging.getLogger(__name__)

def clean_phone_number(phone: str) -> Optional[str]:
    """전화번호 정제"""
    if not phone:
        return None

    # 숫자만 추출
    phone_digits = re.sub(r'[^\d]', '', phone)

    # 전화번호 패턴 매칭
    patterns = [
        r'^(02)(\d{3,4})(\d{4})$',  # 서울
        r'^(0\d{2})(\d{3,4})(\d{4})$',  # 지역번호
        r'^(070)(\d{4})(\d{4})$',  # 070
        r'^(01[016789])(\d{3,4})(\d{4})$'  # 휴대폰
    ]

    for pattern in patterns:
        match = re.match(pattern, phone_digits)
        if match:
            return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"

    return phone_digits if len(phone_digits) >= 8 else None

def create_output_directory(output_dir: str) -> str:
    """출력 디렉토리 생성"""
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    return output_dir

def generate_filename(format_string: str) -> str:
    """날짜 기반 파일명 생성"""
    current_date = datetime.now().strftime("%Y%m%d_%H%M%S")
    return format_string.format(date=current_date)

def save_to_excel(data: list, filename: str, output_dir: str) -> str:
    """데이터를 엑셀 파일로 저장"""
    if not data:
        raise ValueError("저장할 데이터가 없습니다.")

    df = pd.DataFrame(data)

    # 컬럼 순서 정리
    column_order = ['지역', '키워드', '가게명', '주소', '평점', '전화번호', '카테고리', '크롤링_시간']
    existing_columns = [col for col in column_order if col in df.columns]
    df = df[existing_columns]

    # 파일 저장
    filepath = os.path.join(output_dir, filename)
    df.to_excel(filepath, index=False, engine='openpyxl')

    return filepath

async def random_delay(min_seconds: int = 2, max_seconds: int = 3):
    """랜덤 딜레이"""
    delay = random.uniform(min_seconds, max_seconds)
    await asyncio.sleep(delay)

def validate_search_params(location: str, keyword: str) -> bool:
    """검색 파라미터 유효성 검사"""
    if not location or not location.strip():
        return False
    if not keyword or not keyword.strip():
        return False
    return True

def extract_text_content(element, default: str = "") -> str:
    """요소에서 텍스트 추출"""
    try:
        if element:
            return element.text_content().strip()
        return default
    except:
        return default

def format_crawling_result(location: str, keyword: str, place_data: Dict[str, Any]) -> Dict[str, Any]:
    """크롤링 결과 포맷팅"""
    return {
        "지역": location,
        "키워드": keyword,
        "가게명": place_data.get("name", ""),
        "주소": place_data.get("address", ""),
        "평점": place_data.get("rating", ""),
        "전화번호": clean_phone_number(place_data.get("phone", "")),
        "카테고리": place_data.get("category", ""),
        "크롤링_시간": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }