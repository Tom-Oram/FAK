import { Routes, Route } from 'react-router-dom'
import { Layout, Dashboard } from './components/layout'
import {
  PcapAnalyzer,
  DnsLookup,
  SslChecker,
  PathTracer,
  CaptureBuilder,
  IperfServer,
} from './components/tools'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="pcap-analyzer" element={<PcapAnalyzer />} />
        <Route path="dns-lookup" element={<DnsLookup />} />
        <Route path="ssl-checker" element={<SslChecker />} />
        <Route path="path-tracer" element={<PathTracer />} />
        <Route path="capture-builder" element={<CaptureBuilder />} />
        <Route path="iperf-server" element={<IperfServer />} />
      </Route>
    </Routes>
  )
}

export default App
