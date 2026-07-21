import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToStream } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30
  },
  header: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: 'bold'
  },
  section: {
    margin: 10,
    padding: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 5
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5
  },
  label: {
    fontSize: 12,
    color: '#333'
  },
  value: {
    fontSize: 12,
    fontWeight: 'bold'
  }
});

// We avoid coercing strings back to numbers for precision.
// The data passed to this component must have values pre-formatted as strings.
const RevenueReport = ({ data }: { data: any }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.header}>Revenue Report</Text>
      
      <View style={styles.section}>
        <Text style={styles.title}>Period</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Start Date:</Text>
          <Text style={styles.value}>{new Date(data.period.start).toLocaleDateString()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>End Date:</Text>
          <Text style={styles.value}>{new Date(data.period.end).toLocaleDateString()}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>Metrics</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Total Billed:</Text>
          <Text style={styles.value}>$ {data.metrics.totalBilled}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Total Collected:</Text>
          <Text style={styles.value}>$ {data.metrics.totalCollected}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Outstanding Balance:</Text>
          <Text style={styles.value}>$ {data.metrics.outstandingBalance}</Text>
        </View>
      </View>
    </Page>
  </Document>
);

const ComplianceReport = ({ data }: { data: any }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.header}>Compliance Report</Text>
      
      <View style={styles.section}>
        <Text style={styles.title}>Period</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Start Date:</Text>
          <Text style={styles.value}>{new Date(data.period.start).toLocaleDateString()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>End Date:</Text>
          <Text style={styles.value}>{new Date(data.period.end).toLocaleDateString()}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>Status Breakdown</Text>
        {data.metrics.statusBreakdown.map((s: any) => (
          <View style={styles.row} key={s.status}>
            <Text style={styles.label}>{s.status}:</Text>
            <Text style={styles.value}>{s._count.id}</Text>
          </View>
        ))}
      </View>
      
      <View style={styles.section}>
        <Text style={styles.title}>Overdue Items</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Total Overdue:</Text>
          <Text style={styles.value}>{data.metrics.overdueCount}</Text>
        </View>
      </View>
    </Page>
  </Document>
);

export async function generateReportPDF(type: 'revenue' | 'compliance', data: any) {
  const element = type === 'revenue' 
    ? <RevenueReport data={data} /> 
    : <ComplianceReport data={data} />;
  
  return await renderToStream(element);
}

const InvoiceTemplate = ({ invoice }: { invoice: any }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.header}>INVOICE</Text>
      
      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.label}>Invoice Number:</Text>
          <Text style={styles.value}>{invoice.invoiceNumber}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Issue Date:</Text>
          <Text style={styles.value}>{new Date(invoice.issueDate).toLocaleDateString()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Due Date:</Text>
          <Text style={styles.value}>{new Date(invoice.dueDate).toLocaleDateString()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Status:</Text>
          <Text style={styles.value}>{invoice.status}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>Client Details</Text>
        <Text style={styles.value}>{invoice.client?.name || "Client"}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>Totals</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Subtotal:</Text>
          <Text style={styles.value}>$ {invoice.subtotal.toString()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Tax:</Text>
          <Text style={styles.value}>$ {invoice.taxTotal.toString()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Total:</Text>
          <Text style={styles.value}>$ {invoice.total.toString()}</Text>
        </View>
      </View>
    </Page>
  </Document>
);

export async function generateInvoicePDF(invoice: any) {
  return await renderToStream(<InvoiceTemplate invoice={invoice} />);
}
