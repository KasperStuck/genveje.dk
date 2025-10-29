export interface Merchant {
  programid: string;
  programnavn: string;
  programurl: string;
  affiliatelink: string;
  kategoriid: number;
  status: string;
}

export interface Category {
  id: number;
  name: string;
  merchants: Merchant[];
}

export interface AffiliateData {
  categories: Category[];
  lastUpdated: number;
}

export interface PartnerAdsXMLMerchant {
  programid: string;
  programnavn: string;
  programurl: string;
  affiliatelink: string;
  kategoriid: string;
  kategorinavn: string;
  status: string;
}
