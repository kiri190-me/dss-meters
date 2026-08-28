import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NAS(Synology DS218+)의 Docker 컨테이너로 옮기기 위한 설정.
  // 빌드 결과가 .next/standalone 아래에 자립 실행 가능한 형태로 나온다.
  output: "standalone",

  /**
   * 개발 서버를 localhost 가 아닌 주소로 열 때 허용할 곳.
   *
   * 이것이 없으면 Next 가 개발 전용 리소스(HMR 웹소켓·폰트)를 막는다. 그러면
   * 화면은 멀쩡히 뜨는데 **React 가 붙지 않아** 버튼이 죽는다. 검색·필터·언어
   * 전환·엑셀 내보내기는 폼과 링크라 JS 없이도 동작하므로, 겉보기에는 "인쇄
   * 버튼만 안 되는" 것처럼 보인다. 실제로 겪었고 원인을 찾는 데 시간이 걸렸다.
   *
   * 사내망 대역을 통째로 적어 둔다. 이 PC 의 Wi-Fi 주소는 자주 바뀌는데,
   * 바뀔 때마다 여기까지 고치게 하면 같은 일을 또 겪는다.
   * (개발 서버에만 적용된다. next build 결과에는 영향이 없다.)
   */
  allowedDevOrigins: ["192.168.0.*", "192.168.1.*"],
};

export default nextConfig;
